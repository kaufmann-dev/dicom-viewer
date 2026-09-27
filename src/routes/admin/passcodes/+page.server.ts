import { fail } from '@sveltejs/kit';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { listCatalog } from '$lib/server/access';
import { db } from '$lib/server/db';
import { item, passcode, passcodeItem } from '$lib/server/db/schema';
import { generateCode } from '$lib/server/passcode';
import { idSchema, nameSchema } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

const saveSchema = z.object({
	id: idSchema.optional(),
	label: nameSchema,
	expiresAt: z.coerce.date({ error: 'Choose an expiry date.' }),
	itemIds: z.array(idSchema)
});

export const load: PageServerLoad = async ({ locals }) => {
	const passcodes = await db.select().from(passcode).orderBy(desc(passcode.createdAt));
	const grants = await db.select().from(passcodeItem);
	const now = new Date();
	return {
		passcodes: passcodes.map((p) => ({
			...p,
			expired: p.expiresAt <= now,
			itemIds: grants.filter((g) => g.passcodeId === p.id).map((g) => g.itemId)
		})),
		catalog: await listCatalog(locals)
	};
};

async function insertWithUniqueCode(label: string, expiresAt: Date): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const [created] = await db
			.insert(passcode)
			.values({ label, expiresAt, code: generateCode() })
			.onConflictDoNothing({ target: passcode.code })
			.returning({ id: passcode.id });
		if (created) return created.id;
	}
	throw new Error('Could not generate a unique passcode');
}

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const parsed = saveSchema.safeParse({
			id: form.get('id') || undefined,
			label: form.get('label'),
			expiresAt: form.get('expiresAt') || undefined,
			itemIds: form.getAll('itemId')
		});
		if (!parsed.success) return fail(400, { message: parsed.error.issues[0].message });
		const { id, label, expiresAt, itemIds } = parsed.data;

		const passcodeId = id ?? (await insertWithUniqueCode(label, expiresAt));
		await db.transaction(async (tx) => {
			if (id) await tx.update(passcode).set({ label, expiresAt }).where(eq(passcode.id, id));
			await tx.delete(passcodeItem).where(eq(passcodeItem.passcodeId, passcodeId));
			// Items deleted while the form was open are dropped silently.
			const existing = itemIds.length
				? await tx.select({ id: item.id }).from(item).where(inArray(item.id, itemIds))
				: [];
			if (existing.length) {
				await tx
					.insert(passcodeItem)
					.values(existing.map(({ id: itemId }) => ({ passcodeId, itemId })));
			}
		});
		return { savedId: passcodeId };
	},
	delete: async ({ request }) => {
		const id = idSchema.safeParse((await request.formData()).get('id'));
		if (!id.success) return fail(400, { message: 'Unknown passcode.' });
		await db.delete(passcode).where(eq(passcode.id, id.data));
	}
};

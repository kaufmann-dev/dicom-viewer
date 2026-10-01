import { fail } from '@sveltejs/kit';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { listCatalog } from '#lib/server/access.js';
import { db } from '#lib/server/db/index.js';
import { item, passcode, passcodeItem } from '#lib/server/db/schema.js';
import { codeSchema, idSchema, nameSchema } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

const saveSchema = z.object({
	id: idSchema.optional(),
	label: nameSchema,
	code: codeSchema,
	expiresAt: z.coerce.date({ error: 'Choose an expiry date.' }),
	allowDownload: z.boolean(),
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

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const parsed = saveSchema.safeParse({
			id: form.get('id') || undefined,
			label: form.get('label'),
			code: form.get('code'),
			expiresAt: form.get('expiresAt') || undefined,
			allowDownload: form.get('allowDownload') === 'on',
			itemIds: form.getAll('itemId')
		});
		if (!parsed.success) return fail(400, { message: parsed.error.issues[0].message });
		const { id, label, code, expiresAt, allowDownload, itemIds } = parsed.data;

		const [taken] = await db
			.select({ id: passcode.id })
			.from(passcode)
			.where(id ? and(eq(passcode.code, code), ne(passcode.id, id)) : eq(passcode.code, code));
		if (taken) return fail(400, { message: 'This code is already used by another passcode.' });

		const passcodeId = await db.transaction(async (tx) => {
			const values = { label, code, expiresAt, allowDownload };
			const [saved] = id
				? await tx.update(passcode).set(values).where(eq(passcode.id, id)).returning()
				: await tx.insert(passcode).values(values).returning();
			if (!saved) return null;
			await tx.delete(passcodeItem).where(eq(passcodeItem.passcodeId, saved.id));
			// Items deleted while the form was open are dropped silently.
			const existing = itemIds.length
				? await tx.select({ id: item.id }).from(item).where(inArray(item.id, itemIds))
				: [];
			if (existing.length) {
				await tx
					.insert(passcodeItem)
					.values(existing.map(({ id: itemId }) => ({ passcodeId: saved.id, itemId })));
			}
			return saved.id;
		});
		if (!passcodeId) return fail(404, { message: 'This passcode no longer exists.' });
		return { savedId: passcodeId };
	},
	delete: async ({ request }) => {
		const id = idSchema.safeParse((await request.formData()).get('id'));
		if (!id.success) return fail(400, { message: 'Unknown passcode.' });
		await db.delete(passcode).where(eq(passcode.id, id.data));
	}
};

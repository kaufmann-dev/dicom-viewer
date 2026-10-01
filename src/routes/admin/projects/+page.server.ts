import { fail, redirect } from '@sveltejs/kit';
import { count, desc, sum } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { instance, item, project } from '#lib/server/db/schema.js';
import { nameSchema } from '#lib/server/validation.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const projects = await db.select().from(project).orderBy(desc(project.createdAt));
	const items = await db
		.select({ projectId: item.projectId, items: count() })
		.from(item)
		.groupBy(item.projectId);
	const sizes = await db
		.select({ projectId: instance.projectId, bytes: sum(instance.size) })
		.from(instance)
		.groupBy(instance.projectId);
	return {
		projects: projects.map((p) => ({
			...p,
			items: items.find((i) => i.projectId === p.id)?.items ?? 0,
			bytes: Number(sizes.find((s) => s.projectId === p.id)?.bytes ?? 0)
		}))
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const name = nameSchema.safeParse((await request.formData()).get('name'));
		if (!name.success) return fail(400, { message: name.error.issues[0].message });
		const [created] = await db.insert(project).values({ name: name.data }).returning();
		redirect(303, `/admin/projects/${created.id}`);
	}
};

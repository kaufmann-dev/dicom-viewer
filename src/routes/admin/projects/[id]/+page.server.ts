import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { item, project } from '$lib/server/db/schema';
import { itemDir, projectDir, removeStored } from '$lib/server/storage';
import { idSchema, nameSchema } from '$lib/server/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!idSchema.safeParse(params.id).success) error(404, 'Project not found');
	const [row] = await db.select().from(project).where(eq(project.id, params.id));
	if (!row) error(404, 'Project not found');
	const items = await db
		.select()
		.from(item)
		.where(eq(item.projectId, row.id))
		.orderBy(asc(item.studyDate), asc(item.seriesNumber), asc(item.label));
	return { project: row, items };
};

export const actions: Actions = {
	rename: async ({ request, params }) => {
		const name = nameSchema.safeParse((await request.formData()).get('name'));
		if (!name.success) return fail(400, { message: name.error.issues[0].message });
		await db.update(project).set({ name: name.data }).where(eq(project.id, params.id));
	},
	delete: async ({ params }) => {
		await db.delete(project).where(eq(project.id, params.id));
		await removeStored(projectDir(params.id));
		redirect(303, '/admin/projects');
	},
	renameItem: async ({ request, params }) => {
		const form = await request.formData();
		const id = idSchema.safeParse(form.get('id'));
		const label = nameSchema.safeParse(form.get('label'));
		if (!id.success) return fail(400, { message: 'Unknown item.' });
		if (!label.success) return fail(400, { message: label.error.issues[0].message });
		await db
			.update(item)
			.set({ label: label.data })
			.where(and(eq(item.id, id.data), eq(item.projectId, params.id)));
	},
	deleteItem: async ({ request, params }) => {
		const id = idSchema.safeParse((await request.formData()).get('id'));
		if (!id.success) return fail(400, { message: 'Unknown item.' });
		const [deleted] = await db
			.delete(item)
			.where(and(eq(item.id, id.data), eq(item.projectId, params.id)))
			.returning({ id: item.id });
		if (deleted) await removeStored(itemDir(params.id, deleted.id));
	}
};

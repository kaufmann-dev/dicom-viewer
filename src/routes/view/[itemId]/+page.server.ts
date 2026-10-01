import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { canAccessItem } from '#lib/server/access.js';
import { db } from '#lib/server/db/index.js';
import { instance, item } from '#lib/server/db/schema.js';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!UUID.test(params.itemId) || !(await canAccessItem(locals, params.itemId))) {
		error(404, 'Not found');
	}
	const [row] = await db.select().from(item).where(eq(item.id, params.itemId));
	const instances = await db
		.select({ id: instance.id, srContent: instance.srContent })
		.from(instance)
		.where(eq(instance.itemId, row.id))
		.orderBy(asc(instance.sortKey));

	return {
		item: {
			id: row.id,
			projectId: row.projectId,
			kind: row.kind,
			label: row.label,
			modality: row.modality,
			sopClassUid: row.sopClassUid,
			studyDate: row.studyDate,
			studyDescription: row.studyDescription,
			instanceCount: instances.length,
			volume: row.volume
		},
		instanceIds: instances.map((i) => i.id),
		reports: row.kind === 'sr' ? instances.flatMap((i) => (i.srContent ? [i.srContent] : [])) : []
	};
};

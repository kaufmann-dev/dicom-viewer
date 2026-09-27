import {
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';
import type { InstanceGeometry } from '$lib/server/dicom/geometry';
import type { SrDocument } from '$lib/sr';

export * from './auth.schema';

export const itemKind = pgEnum('item_kind', ['image', 'sr', 'stl']);

export const project = pgTable('project', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** One viewable unit: a DICOM series (image or structured report) or an STL mesh. */
export const item = pgTable(
	'item',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		kind: itemKind('kind').notNull(),
		label: text('label').notNull(),
		modality: text('modality'),
		sopClassUid: text('sop_class_uid'),
		studyInstanceUid: text('study_instance_uid'),
		studyDate: text('study_date'),
		studyDescription: text('study_description'),
		seriesInstanceUid: text('series_instance_uid'),
		seriesNumber: integer('series_number'),
		instanceCount: integer('instance_count').notNull().default(0),
		volume: boolean('volume').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [unique().on(t.projectId, t.seriesInstanceUid), index().on(t.projectId)]
);

/** One stored file: a DICOM instance or the STL file of an STL item. */
export const instance = pgTable(
	'instance',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		itemId: uuid('item_id')
			.notNull()
			.references(() => item.id, { onDelete: 'cascade' }),
		sopInstanceUid: text('sop_instance_uid').notNull(),
		path: text('path').notNull(),
		size: integer('size').notNull(),
		geometry: jsonb('geometry').$type<InstanceGeometry>(),
		sortKey: doublePrecision('sort_key').notNull().default(0),
		srContent: jsonb('sr_content').$type<SrDocument>()
	},
	(t) => [unique().on(t.projectId, t.sopInstanceUid), index().on(t.itemId)]
);

export const passcode = pgTable('passcode', {
	id: uuid('id').primaryKey().defaultRandom(),
	label: text('label').notNull(),
	code: text('code').notNull().unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	allowDownload: boolean('allow_download').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const passcodeItem = pgTable(
	'passcode_item',
	{
		passcodeId: uuid('passcode_id')
			.notNull()
			.references(() => passcode.id, { onDelete: 'cascade' }),
		itemId: uuid('item_id')
			.notNull()
			.references(() => item.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.passcodeId, t.itemId] })]
);

export const viewerSession = pgTable('viewer_session', {
	/** SHA-256 of the session token stored in the cookie. */
	id: text('id').primaryKey(),
	passcodeId: uuid('passcode_id')
		.notNull()
		.references(() => passcode.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

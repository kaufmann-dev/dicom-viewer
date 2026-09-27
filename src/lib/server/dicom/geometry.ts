export type InstanceGeometry = {
	position?: number[];
	orientation?: number[];
	rows?: number;
	columns?: number;
	frames: number;
	instanceNumber?: number;
};

export type SeriesLayout = {
	/** True when the instances form a regular stack that can be reconstructed as a volume (MPR). */
	volume: boolean;
	sortKeys: Map<string, number>;
};

const EPSILON = 1e-3;
/** Maximum relative deviation of a slice gap from the median gap. */
const SPACING_TOLERANCE = 0.2;

function sameVector(a: number[], b: number[]): boolean {
	return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < EPSILON);
}

function sliceNormal(orientation: number[]): [number, number, number] {
	const [rx, ry, rz, cx, cy, cz] = orientation;
	return [ry * cz - rz * cy, rz * cx - rx * cz, rx * cy - ry * cx];
}

function dot(a: number[], b: number[]): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Orders the instances of a series along the slice normal and decides whether the series
 * is a regular volume. Falls back to InstanceNumber ordering when geometry is missing.
 */
export function layoutSeries(
	instances: { id: string; geometry: InstanceGeometry | null }[]
): SeriesLayout {
	const sortKeys = new Map<string, number>();
	const first = instances[0]?.geometry;
	const orientation = first?.orientation;
	const hasGeometry =
		orientation?.length === 6 &&
		instances.every(
			(i) =>
				i.geometry?.position?.length === 3 &&
				i.geometry.orientation?.length === 6 &&
				sameVector(i.geometry.orientation, orientation)
		);

	if (!hasGeometry) {
		instances.forEach((i, index) => sortKeys.set(i.id, i.geometry?.instanceNumber ?? index));
		return { volume: false, sortKeys };
	}

	const normal = sliceNormal(orientation);
	for (const i of instances) sortKeys.set(i.id, dot(i.geometry!.position!, normal));

	const uniformFrames = instances.every(
		(i) =>
			i.geometry!.frames <= 1 &&
			i.geometry!.rows === first!.rows &&
			i.geometry!.columns === first!.columns
	);
	if (instances.length < 3 || !uniformFrames) return { volume: false, sortKeys };

	const positions = [...sortKeys.values()].sort((a, b) => a - b);
	const gaps = positions.slice(1).map((p, index) => p - positions[index]);
	const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
	const regular =
		median > EPSILON && gaps.every((g) => Math.abs(g - median) <= median * SPACING_TOLERANCE);

	return { volume: regular, sortKeys };
}

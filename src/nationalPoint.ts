/**
 * National Point Number → WGS84.
 *
 * A National Point Number is a grid reference, not a coordinate: two Hangul letters name a
 * 100 km cell and eight digits give the offset inside it in 10 m units, so
 * `다사52414090` means "52,410 m east and 40,900 m north of the south-west corner
 * of cell 다사". The grid is laid over UTM-K (EPSG:5179, Korea 2000 / Unified CS),
 * which is a Transverse Mercator projection on GRS80 — so decoding is: letters and
 * digits → UTM-K easting/northing → inverse TM → latitude/longitude.
 *
 * Leaflet-free and DOM-free on purpose, like heading.ts: this is arithmetic, and
 * keeping it separate is what let the origin below be checked against real
 * landmarks before any of it was drawn.
 */

/** The 14 letters of the grid alphabet. Index is the cell number in both axes. */
const GRID_LETTERS = '가나다라마바사아자차카타파하';
/**
 * South-west corner of cell 가가 in EPSG:5179 metres. Not derivable from the code —
 * it is the definition of the grid — so it is worth saying how it was confirmed:
 * 다사52414090 decodes to 37.46609, 126.96184 and 다사49013778 to 37.43779,
 * 126.92361, each of which matches the surveyed position of the sign carrying that
 * code. Either origin component being wrong moves the whole set by a multiple of
 * 100 km.
 */
const GRID_ORIGIN_X = 700_000;
const GRID_ORIGIN_Y = 1_300_000;
/** Cell size and digit unit, both in metres. */
const GRID_CELL = 100_000;
const GRID_UNIT = 10;

/** GRS80 and the EPSG:5179 projection parameters. */
const A = 6378137.0;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
/** e'^2, the second eccentricity squared. */
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const LAT_ORIGIN = (38 * Math.PI) / 180;
const LON_ORIGIN = (127.5 * Math.PI) / 180;
const FALSE_EASTING = 1_000_000;
const FALSE_NORTHING = 2_000_000;

/** Two grid letters followed by 4 easting digits and 4 northing digits. */
const CODE_PATTERN = /^([가-하])([가-하])(\d{4})(\d{4})$/;

export type NationalPoint = {
  /** 시/도. Always present in the file; shown in the popup joined to `district`. */
  province: string;
  /** 시/군/구. Two words for the rows under 안양시 (안양시 동안구, 안양시 만안구) — that
   *  space is the source's own, not a join. */
  district: string;
  /** 지점번호, e.g. 다사52414090. */
  code: string;
  /** 사물유형 — what the number is posted on. */
  kind: string;
  /** 이름. Empty for the rows the source has no name for, which is most of them. */
  name: string;
  lat: number;
  lon: number;
};

/** Meridional arc from the equator to `phi`, Snyder eq. 3-21. */
function meridianArc(phi: number): number {
  return (
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi))
  );
}

const M_ORIGIN = meridianArc(LAT_ORIGIN);

/**
 * Inverse Transverse Mercator, Snyder eqs. 8-1 to 8-9 — the series form rather than
 * an iterative solve. Truncating at the sixth power costs well under a metre at
 * Korea's ~45 km from the central meridian, which is nothing against a grid whose
 * own resolution is 10 m.
 */
function utmkToWgs84(x: number, y: number): { lat: number; lon: number } {
  const dx = x - FALSE_EASTING;
  const dy = y - FALSE_NORTHING;

  const m = M_ORIGIN + dy / K0;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const mu = m / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));

  // The footpoint latitude: where the meridian arc dy would land on the central
  // meridian itself.
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const c1 = EP2 * cosPhi1 ** 2;
  const t1 = tanPhi1 ** 2;
  const n1 = A / Math.sqrt(1 - E2 * sinPhi1 ** 2);
  const r1 = (A * (1 - E2)) / (1 - E2 * sinPhi1 ** 2) ** 1.5;
  const d = dx / (n1 * K0);

  const lat =
    phi1 -
    ((n1 * tanPhi1) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6) / 720);

  const lon =
    LON_ORIGIN +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5) / 120) /
      cosPhi1;

  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI };
}

/**
 * The single place a 지점번호 becomes a position.
 *
 * Returns null rather than throwing for anything malformed: the input is a text file
 * a user dropped into data/, and one bad row must not take the whole layer with it.
 */
export function decodeNationalPoint(code: string): { lat: number; lon: number } | null {
  // NFC first: Hangul copied out of a spreadsheet can arrive decomposed, and a
  // decomposed 다 is three code points that no single-character class will match.
  const match = CODE_PATTERN.exec(code.normalize('NFC'));
  if (!match) return null;

  const col = GRID_LETTERS.indexOf(match[1]);
  const row = GRID_LETTERS.indexOf(match[2]);
  // The [가-하] class is a code-point range, so it admits letters that are not in
  // the 14-letter alphabet (like 갸 or 댜). Those are not grid cells.
  if (col < 0 || row < 0) return null;

  // First letter is the east axis, second the north — the opposite of the row-then-
  // column order a table would use, and the thing to check first if every point ever
  // lands 100 km off.
  const x = GRID_ORIGIN_X + col * GRID_CELL + Number(match[3]) * GRID_UNIT;
  const y = GRID_ORIGIN_Y + row * GRID_CELL + Number(match[4]) * GRID_UNIT;
  return utmkToWgs84(x, y);
}

/**
 * Parses the 시·도 / 시·군·구 / 지점번호 / 사물유형 / 이름 TSV.
 *
 * Every tolerance here answers something actually present in the file: rows that stop
 * after 사물유형 because they have no 이름 (most of them), a header row, CRLF, a
 * trailing blank line, and one 지점번호 (다사49293899) that appears twice.
 *
 * That duplicate is deduplicated, first row wins. It is not two signs: it is one
 * sign on the 금천구 / 안양시 만안구 boundary, filed once under each, identical in
 * 지점번호 and 사물유형 and nameless in both. The one thing the two rows disagree on
 * is now on screen, so the tiebreak is worth stating: first row wins means the popup
 * reads 서울특별시 금천구 and never 경기도 안양시 만안구. Which of the two it shows is
 * the order of the file, not a fact about which side of the line the sign stands on.
 * Keeping both would stack two markers on the same coordinate, the lower one
 * permanently unclickable, to say almost the same thing twice.
 */
export function parseNationalPoints(tsv: string): NationalPoint[] {
  const points: NationalPoint[] = [];
  const seen = new Set<string>();

  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split('\t');
    if (fields.length < 4) continue;

    const code = fields[2].trim();
    if (seen.has(code)) continue;
    // Also what skips the header: its 지점번호 cell holds the literal text 지점번호,
    // which is not a decodable code. So a file exported without one parses too.
    const at = decodeNationalPoint(code);
    if (!at) continue;
    seen.add(code);

    points.push({
      // Left exactly as the file has them, like 사물유형 below: these are only ever
      // rendered, never matched against anything typed, so the NFC fold 이름 needs
      // would be a third rule for the same kind of text.
      province: fields[0].trim(),
      district: fields[1].trim(),
      code,
      kind: fields[3].trim(),
      // NFC for the same reason trails.ts folds names: Hangul from a macOS export
      // arrives decomposed and would otherwise not match anything typed.
      name: (fields[4] ?? '').trim().normalize('NFC'),
      lat: at.lat,
      lon: at.lon,
    });
  }

  return points;
}

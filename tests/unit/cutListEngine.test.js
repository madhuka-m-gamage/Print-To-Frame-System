import { describe, it, expect } from 'vitest';
import { calculateCutList, mmToFtIn, ftToMm, packStockBars, STEEL_PROFILES } from '../../src/utils/cutListEngine';

describe('cutListEngine', () => {
  it('converts mm to feet and fractional inches accurately', () => {
    // 304.8 mm = 1 foot
    expect(mmToFtIn(304.8)).toBe('1\' 0"');
    // 609.6 mm = 2 feet
    expect(mmToFtIn(609.6)).toBe('2\' 0"');
    // 0 or invalid mm
    expect(mmToFtIn(0)).toBe('0\' 0"');
    expect(mmToFtIn(null)).toBe('0\' 0"');
    // 25.4 mm = 1 inch
    expect(mmToFtIn(25.4)).toBe('0\' 1"');
  });

  it('converts feet to mm accurately', () => {
    expect(ftToMm(1)).toBe(305);
    expect(ftToMm(10)).toBe(3048);
    expect(ftToMm(0)).toBe(0);
  });

  it('calculates outer miter cut list and diagonal squareness target', () => {
    // 900mm x 600mm frame
    const result = calculateCutList({
      widthMm: 900,
      heightMm: 600,
      depthMm: 45,
      profileKey: 'box_1_5'
    });

    expect(result.dimensions.widthMm).toBe(900);
    expect(result.dimensions.heightMm).toBe(600);
    expect(result.dimensions.depthMm).toBe(45);

    // Diagonal = sqrt(900^2 + 600^2) = sqrt(810000 + 360000) = sqrt(1170000) ~= 1081.66 -> 1082 mm
    expect(result.dimensions.diagonalMm).toBe(1082);
    expect(result.dimensions.squarenessToleranceMm).toBe(2);

    // Should have 4 outer members (H1, H2, V1, V2)
    const outerItems = result.cutItems.filter(i => i.isOuter);
    expect(outerItems.length).toBe(4);
    expect(outerItems.map(i => i.cutType)).toContain('45° Miter Both Ends');

    // 900mm width is > 600mm span, so 1 vertical stiffener should be generated
    const vertStiffeners = result.cutItems.filter(i => i.mark === 'S-VERT');
    expect(vertStiffeners.length).toBe(1);
    expect(vertStiffeners[0].qty).toBe(1);

    // Raw material summary
    expect(result.summary.totalCutPieces).toBeGreaterThanOrEqual(5);
    expect(result.summary.standardStockBars).toBeGreaterThanOrEqual(1);
    expect(result.summary.barLengthFeet).toBe(20);
    expect(result.hardware.length).toBeGreaterThan(0);
  });

  it('calculates standard stock bar requirement correctly for large frames', () => {
    // Large 10ft x 4ft frame (3048mm x 1219mm)
    const result = calculateCutList({
      widthMm: 3048,
      heightMm: 1219,
      depthMm: 50,
      profileKey: 'box_2_0'
    });

    expect(result.dimensions.diagonalMm).toBe(3283);
    // Outer perimeter = 2 * (3048 + 1219) = 8534mm + stiffeners
    // Standard 20ft bar is ~6096mm, so this frame requires at least 2 bars
    expect(result.summary.standardStockBars).toBeGreaterThanOrEqual(2);
  });

  it('defaults gracefully on empty or invalid inputs', () => {
    const result = calculateCutList({});
    expect(result.dimensions.widthMm).toBe(900);
    expect(result.dimensions.heightMm).toBe(600);
    expect(result.profile.id).toBe('box_1_5');
    expect(result.cutItems.length).toBeGreaterThanOrEqual(4);
  });

  describe('packStockBars (first-fit-decreasing)', () => {
    it('packs pieces into as few bars as first-fit-decreasing allows', () => {
      // 3000 + 3000 fill one 6000 bar and three 2000s fill another; a linear estimate with a
      // 5% allowance would have ordered three bars.
      expect(packStockBars([3000, 3000, 2000, 2000, 2000], 6000, 0).bars).toBe(2);
    });

    it('charges one kerf per cut and reports the length the bars must carry', () => {
      const res = packStockBars([2000, 2000, 2000], 6000, 10);
      expect(res.usedMm).toBe(6030);
      expect(res.bars).toBe(2);
    });

    it('lays a piece longer than a bar across whole bars and reuses the offcut', () => {
      expect(packStockBars([7000, 1000], 6000, 0).bars).toBe(2);
      expect(packStockBars([13000], 6000, 0).bars).toBe(3);
    });

    it('needs no bars for no pieces', () => {
      expect(packStockBars([], 6000, 3).bars).toBe(0);
    });
  });

  it('orders bars with packing, not a linear estimate, in the cut list summary', () => {
    const res = calculateCutList({ widthMm: 3048, heightMm: 1219, depthMm: 50, profileKey: 'box_2_0' });
    const pieces = res.cutItems.flatMap(i => Array(i.qty).fill(i.lengthMm));
    expect(res.summary.standardStockBars).toBe(Math.max(1, packStockBars(pieces, 6096, 3).bars));
  });
});

describe('defaultFrameDimensions and rib counts (Phase 7 6.4b)', () => {
  it('sizes a 3:2 frame that keeps the full contract area', async () => {
    const { defaultFrameDimensions } = await import('../../src/utils/cutListEngine');
    const { widthMm, heightMm } = defaultFrameDimensions(20);
    const areaSqFt = (widthMm * heightMm) / (25.4 * 25.4) / 144;
    expect(areaSqFt).toBeGreaterThan(19.9);
    expect(areaSqFt).toBeLessThan(20.1);
    expect(widthMm / heightMm).toBeCloseTo(1.5, 1);
  });

  it('falls back to 900 x 600 with no usable area', async () => {
    const { defaultFrameDimensions } = await import('../../src/utils/cutListEngine');
    expect(defaultFrameDimensions(0)).toEqual({ widthMm: 900, heightMm: 600 });
    expect(defaultFrameDimensions(undefined)).toEqual({ widthMm: 900, heightMm: 600 });
  });

  it('exposes the rib counts the blueprint draws', async () => {
    const { calculateCutList } = await import('../../src/utils/cutListEngine');
    const wide = calculateCutList({ widthMm: 2400, heightMm: 1500 });
    expect(wide.vRibCount).toBeGreaterThan(0);
    expect(wide.hRibCount).toBeGreaterThanOrEqual(0);
    expect(calculateCutList({ widthMm: 300, heightMm: 300 }).vRibCount).toBe(0);
  });
});

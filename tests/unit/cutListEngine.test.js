import { describe, it, expect } from 'vitest';
import { calculateCutList, mmToFtIn, ftToMm, STEEL_PROFILES } from '../../src/utils/cutListEngine';

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
});

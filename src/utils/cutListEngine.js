/**
 * ============================================================
 * Print To Frame ERP — Steel Frame Cut-List & BOM Engine
 * ============================================================
 * Calculates outer miter cuts, internal stiffener ribs,
 * diagonal squareness verification targets, and standard 20ft
 * stock bar requisitioning for workshop fabricators.
 */

export const STEEL_PROFILES = {
  'box_1_0': {
    id: 'box_1_0',
    label: '1.0" × 1.0" (25×25mm) Box Iron',
    widthMm: 25.4,
    heightMm: 25.4,
    wallMm: 1.5,
    weightKgPerMeter: 1.12,
    defaultStockFt: 20,
    category: 'Interior Standard'
  },
  'box_1_5': {
    id: 'box_1_5',
    label: '1.5" × 1.5" (38×38mm) Box Iron',
    widthMm: 38.1,
    heightMm: 38.1,
    wallMm: 1.8,
    weightKgPerMeter: 1.95,
    defaultStockFt: 20,
    category: 'Heavy-Duty / Large Wrap'
  },
  'box_2_0': {
    id: 'box_2_0',
    label: '2.0" × 2.0" (50×50mm) Box Iron',
    widthMm: 50.8,
    heightMm: 50.8,
    wallMm: 2.0,
    weightKgPerMeter: 2.92,
    defaultStockFt: 20,
    category: 'Outdoor / Signboard Truss'
  },
  'rect_1_2': {
    id: 'rect_1_2',
    label: '1.0" × 2.0" (25×50mm) Rectangular Tube',
    widthMm: 25.4,
    heightMm: 50.8,
    wallMm: 1.8,
    weightKgPerMeter: 1.95,
    defaultStockFt: 20,
    category: 'Perimeter Stiffener'
  }
};

export const STANDARD_STOCK_LENGTH_MM = 6096; // 20 feet in mm
export const DEFAULT_MAX_UNSUPPORTED_SPAN_MM = 600; // 600mm / ~2 feet max span before stiffener
export const DEFAULT_SAW_KERF_MM = 3; // 3mm abrasive chop-saw kerf allowance per cut

/**
 * Converts millimeters to feet and fractional inches for workshop display
 * @param {number} mm 
 * @returns {string} e.g. "9' 10 1/8\"" or "0' 11 3/4\""
 */
export function mmToFtIn(mm) {
  if (!mm || isNaN(mm) || mm <= 0) return "0' 0\"";
  const totalInches = mm / 25.4;
  const feet = Math.floor(totalInches / 12);
  const remainingInches = totalInches % 12;
  const wholeInches = Math.floor(remainingInches);
  const fraction = remainingInches - wholeInches;

  // Convert fraction to nearest 1/16th
  const sixteenths = Math.round(fraction * 16);
  if (sixteenths === 16) {
    const adjustedInches = wholeInches + 1;
    if (adjustedInches === 12) {
      return `${feet + 1}' 0"`;
    }
    return `${feet}' ${adjustedInches}"`;
  }
  if (sixteenths === 0) {
    return `${feet}' ${wholeInches}"`;
  }

  // Simplify fractions
  let num = sixteenths;
  let den = 16;
  while (num % 2 === 0 && den % 2 === 0) {
    num /= 2;
    den /= 2;
  }

  if (wholeInches === 0) {
    return `${feet}' ${num}/${den}"`;
  }
  return `${feet}' ${wholeInches} ${num}/${den}"`;
}

/**
 * Converts feet to millimeters
 * @param {number} ft 
 * @returns {number}
 */
export function ftToMm(ft) {
  if (!ft || isNaN(ft)) return 0;
  return Math.round(Number(ft) * 304.8);
}

/**
 * Calculates complete cutting schedule, internal stiffeners, squareness target,
 * and stock requisitioning for a steel frame.
 * 
 * @param {Object} options
 * @param {number} options.widthMm - Outer frame width in mm
 * @param {number} options.heightMm - Outer frame height in mm
 * @param {number} [options.depthMm=45] - Frame profile depth in mm
 * @param {string} [options.profileKey='box_1_5'] - Key from STEEL_PROFILES
 * @param {number} [options.maxSpanMm=DEFAULT_MAX_UNSUPPORTED_SPAN_MM] - Max span before adding intermediate rib
 * @param {number} [options.stockLengthMm=STANDARD_STOCK_LENGTH_MM] - Standard bar length in mm (default 20ft)
 * @param {number} [options.sawKerfMm=DEFAULT_SAW_KERF_MM] - Saw cut kerf in mm
 * @returns {Object} Comprehensive Cut-List & BOM Result
 */
export function calculateCutList({
  widthMm = 900,
  heightMm = 600,
  depthMm = 45,
  profileKey = 'box_1_5',
  maxSpanMm = DEFAULT_MAX_UNSUPPORTED_SPAN_MM,
  stockLengthMm = STANDARD_STOCK_LENGTH_MM,
  sawKerfMm = DEFAULT_SAW_KERF_MM
} = {}) {
  const w = Math.max(10, Math.round(Number(widthMm) || 900));
  const h = Math.max(10, Math.round(Number(heightMm) || 600));
  const d = Math.max(10, Math.round(Number(depthMm) || 45));

  const profile = STEEL_PROFILES[profileKey] || STEEL_PROFILES['box_1_5'];
  const profileSize = profile.widthMm;

  // 1. Diagonal verification target for zero-skew squaring
  // D = sqrt(W^2 + H^2)
  const diagonalMm = Math.round(Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2)));
  const diagonalFtIn = mmToFtIn(diagonalMm);

  const cutItems = [];

  // 2. Outer Perimeter Members (45° Miter Cuts on both ends for clean corner joinery)
  cutItems.push({
    mark: 'H1',
    description: 'Top Horizontal Outer Member',
    lengthMm: w,
    lengthFtIn: mmToFtIn(w),
    qty: 1,
    cutType: '45° Miter Both Ends',
    profile: profile.label,
    isOuter: true
  });

  cutItems.push({
    mark: 'H2',
    description: 'Bottom Horizontal Outer Member',
    lengthMm: w,
    lengthFtIn: mmToFtIn(w),
    qty: 1,
    cutType: '45° Miter Both Ends',
    profile: profile.label,
    isOuter: true
  });

  cutItems.push({
    mark: 'V1',
    description: 'Left Vertical Outer Member',
    lengthMm: h,
    lengthFtIn: mmToFtIn(h),
    qty: 1,
    cutType: '45° Miter Both Ends',
    profile: profile.label,
    isOuter: true
  });

  cutItems.push({
    mark: 'V2',
    description: 'Right Vertical Outer Member',
    lengthMm: h,
    lengthFtIn: mmToFtIn(h),
    qty: 1,
    cutType: '45° Miter Both Ends',
    profile: profile.label,
    isOuter: true
  });

  // 3. Intermediate Reinforcement Stiffeners / Braces
  // To prevent canvas bowing and flexing under tension
  const innerHeightMm = Math.max(0, h - (profileSize * 2));
  const innerWidthMm = Math.max(0, w - (profileSize * 2));

  // Determine vertical rib divisions based on width
  let vRibCount = 0;
  if (w > maxSpanMm) {
    vRibCount = Math.floor(w / maxSpanMm);
    if (w % maxSpanMm < (maxSpanMm * 0.25)) {
      vRibCount = Math.max(1, vRibCount - 1);
    }
  }

  // Determine horizontal rib divisions based on height (if height is large)
  let hRibCount = 0;
  if (h > maxSpanMm * 1.5) {
    hRibCount = Math.floor(h / (maxSpanMm * 1.5));
    if (h % (maxSpanMm * 1.5) < (maxSpanMm * 0.25)) {
      hRibCount = Math.max(1, hRibCount - 1);
    }
  }

  if (vRibCount > 0 && innerHeightMm > 0) {
    cutItems.push({
      mark: 'S-VERT',
      description: 'Intermediate Vertical Reinforcement Rib',
      lengthMm: Math.round(innerHeightMm),
      lengthFtIn: mmToFtIn(Math.round(innerHeightMm)),
      qty: vRibCount,
      cutType: '90° Square Butt Cut',
      profile: profile.label,
      isOuter: false,
      note: `Equally spaced across ${w}mm span (spacing ~${Math.round(w / (vRibCount + 1))}mm)`
    });
  }

  if (hRibCount > 0 && innerWidthMm > 0) {
    const segmentWidth = vRibCount > 0 
      ? Math.round((innerWidthMm - (vRibCount * profileSize)) / (vRibCount + 1))
      : Math.round(innerWidthMm);

    const totalHRibSegments = vRibCount > 0 ? hRibCount * (vRibCount + 1) : hRibCount;

    cutItems.push({
      mark: 'S-HORZ',
      description: 'Intermediate Horizontal Cross Brace',
      lengthMm: segmentWidth,
      lengthFtIn: mmToFtIn(segmentWidth),
      qty: totalHRibSegments,
      cutType: '90° Square Butt Cut',
      profile: profile.label,
      isOuter: false,
      note: `Cross-tie stiffener at ${Math.round(h / (hRibCount + 1))}mm height`
    });
  }

  // 4. Hardware & Corner Reinforcement Gussets
  const hardware = [
    {
      item: 'Corner Gusset Reinforcement Plates',
      spec: '75mm × 75mm × 2mm Triangular Mild Steel',
      qty: 4,
      purpose: 'Corner weld reinforcement & anti-racking rigidity'
    },
    {
      item: 'Anti-Rust Zinc Phosphate Primer',
      spec: 'Epoxy / Oxide Primer Coat',
      qty: `${Math.max(0.2, Math.round(((w * 2 + h * 2) / 1000) * 0.05 * 10) / 10)} L`,
      purpose: 'Complete frame dip / spray anti-corrosion barrier'
    },
    {
      item: 'Wall Mounting Brackets / Cleats',
      spec: 'Heavy-Duty Keyhole / Standoff Brackets',
      qty: w >= 2400 ? 4 : 2,
      purpose: 'Secure wall anchoring'
    }
  ];

  // 5. Total Material Sizing & Standard 20ft Bar Requisition
  let totalLengthMm = 0;
  let totalCuts = 0;

  cutItems.forEach(item => {
    totalLengthMm += (item.lengthMm * item.qty);
    totalCuts += item.qty;
  });

  const totalKerfWasteMm = totalCuts * sawKerfMm;
  const grossLengthMm = totalLengthMm + totalKerfWasteMm;

  const totalLengthMeters = Math.round((grossLengthMm / 1000) * 100) / 100;
  const totalLengthFeet = Math.round((grossLengthMm / 304.8) * 10) / 10;

  const barCapacityMm = stockLengthMm;
  const stockBarsRequired = Math.max(1, Math.ceil((grossLengthMm * 1.05) / barCapacityMm));
  const estimatedScrapMm = Math.max(0, (stockBarsRequired * barCapacityMm) - grossLengthMm);
  const scrapPercentage = Math.round((estimatedScrapMm / (stockBarsRequired * barCapacityMm)) * 100);

  const estimatedWeightKg = Math.round((totalLengthMeters * profile.weightKgPerMeter) * 10) / 10;

  return {
    dimensions: {
      widthMm: w,
      heightMm: h,
      depthMm: d,
      widthFtIn: mmToFtIn(w),
      heightFtIn: mmToFtIn(h),
      depthFtIn: mmToFtIn(d),
      diagonalMm,
      diagonalFtIn,
      squarenessToleranceMm: 2
    },
    profile,
    cutItems,
    hardware,
    summary: {
      totalCutPieces: totalCuts,
      netLengthMeters: Math.round((totalLengthMm / 1000) * 100) / 100,
      grossLengthMeters: totalLengthMeters,
      grossLengthFeet: totalLengthFeet,
      standardStockBars: stockBarsRequired,
      barLengthFeet: Math.round(stockLengthMm / 304.8),
      estimatedWeightKg,
      estimatedScrapPercentage: scrapPercentage
    }
  };
}

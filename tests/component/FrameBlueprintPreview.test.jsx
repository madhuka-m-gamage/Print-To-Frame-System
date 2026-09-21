import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FrameBlueprintPreview from '@/features/fabrication/FrameBlueprintPreview';

const lineCount = (c) => c.container.querySelectorAll('line').length;

describe('FrameBlueprintPreview', () => {
  it('states the structural tolerance', () => {
    render(<FrameBlueprintPreview width={900} height={600} />);
    expect(screen.getByText(/±2\.0mm \(Structural Steel\)/)).toBeTruthy();
  });

  it('draws one line per stiffener rib and no fixed X-brace', () => {
    const none = render(<FrameBlueprintPreview width={900} height={600} />);
    const withRibs = render(<FrameBlueprintPreview width={2400} height={1500} vRibCount={2} hRibCount={1} />);
    expect(lineCount(withRibs) - lineCount(none)).toBe(3);
  });
});

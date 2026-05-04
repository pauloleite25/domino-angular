# Principles

Use this file when the main skill needs sharper implementation guidance.

## Recommended Defaults

- Spacing base unit: 4px or 8px, but commit to one system per product.
- Border-first products: use low-opacity borders before shadows.
- Inputs: slightly darker than surrounding surfaces.
- Numbers in dense interfaces: prefer tabular numerals.
- Surface hierarchy: define at least base, raised and overlay levels.

## Dark Mode Notes

- Favor borders over heavy shadows.
- Reduce semantic saturation slightly to avoid glow.
- Keep the same hue family across surfaces and shift lightness for hierarchy.

## Code-Level Checks

- Avoid random one-off spacing values.
- Avoid mixed radius language in the same UI family.
- Prefer token names that evoke the product's world instead of generic scales.

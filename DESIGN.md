---
name: StockScan
description: A high-clarity handheld workflow for receiving scanned inventory.
colors:
  ink: "#071721"
  panel: "#0E2633"
  signal: "#C8FF3D"
  alert: "#FF7A59"
  paper: "#F4F7F4"
  text: "#EAF2EC"
typography:
  display:
    fontFamily: "Tahoma, Leelawadee UI, sans-serif"
    fontWeight: 800
  body:
    fontFamily: "Tahoma, Leelawadee UI, sans-serif"
    fontWeight: 500
rounded:
  compact: "12px"
  control: "16px"
spacing:
  tight: "8px"
  base: "16px"
  wide: "24px"
---

<!-- SEED: established with the user before implementation; re-run $impeccable document once there's code to capture the actual tokens and components. -->

# Design System: StockScan

## Overview

**Creative North Star: "Scan Signal"**

This is an operational instrument, informed by the high-visibility markings on loading labels and handheld scanning equipment. A deep ink surface keeps the interface stable under warehouse lighting; lime signals the active path; coral signals attention. The page should feel like it comes alive at the moment a barcode is ready to scan, while leaving all functional text and controls plain, immediate, and touchable.

**Key Characteristics:** high-contrast field display; strong live-status language; oversized scan action; expressive but bounded signal motion.

## Colors

Use ink as the primary field, lime for the one active action or positive scanning state, and coral only for errors or attention states. Large color fields establish hierarchy instead of gradients or decorative glows.

**The One Signal Rule.** Only one primary action on a screen carries lime at a time.

## Typography

Use a heavy system sans-serif display face that remains clear on Android handheld devices. Product names and scan states receive the largest type; supporting labels remain sentence case and compact.

## Layout

Handheld layouts use a single vertical task lane with a persistent identity strip, a dominant scan field, then confirmation and form details. Wider screens retain the same sequencing but split supporting controls into two columns. Touch targets never shrink below 44px.

## Elevation & Depth

Depth comes from ink-on-ink tonal layers and restrained, directional shadows below active controls. Panels are not nested merely for decoration.

## Shapes

Controls use softly squared 12–16px corners. Scan and save actions are broad, solid, and decisive; status markers may be pill-shaped.

## Components

The scan field is the signature component: it behaves like a live receiving dock with a calm moving scan line when idle and a solid result panel when matched.

## Do's and Don'ts

### Do:
- **Do** give the barcode field the largest interactive area in the first viewport.
- **Do** use motion only to communicate an active scan/search state and respect reduced-motion settings.
- **Do** keep status copy short, explicit, and adjacent to the action it describes.

### Don't:
- **Don't** use generic dashboard metric cards as the page's primary composition.
- **Don't** hide vital actions behind an icon-only control.
- **Don't** use decorative effects that lower barcode or product-text legibility.

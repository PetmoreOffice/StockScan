# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Warehouse and branch staff operating a Urovo CT58 handheld scanner. They work at a scanning station and need to see the current state and complete a scan quickly on a small touchscreen.

## Product Purpose

The product records incoming inventory: staff sign in, scan a barcode, confirm product details, choose a branch, enter quantity and expiry date, then save the record to a shared Excel report.

## Positioning

It combines keyboard-wedge barcode capture with a protected central product lookup, read-only branch data, and a single downloadable report shared across operators.

## Operating Context

The scanning flow runs on Urovo CT58 handheld devices. Firebase authenticates users, the central inventory API provides product data, SQL Server provides branches, and the server writes the shared Excel workbook.

## Capabilities and Constraints

- The login, scan lookup, save, branch selection, and complete-report download workflows must remain working.
- Only @newgenman.co.th and @petmoregroups.com accounts can use protected APIs.
- The app must be legible and touch-friendly on a handheld scanner screen.
- SQL Server access remains read-only; reports are retrieved from the server-side Excel file.

## Brand Commitments

The confirmed product name is ระบบสแกนสินค้า. The requested redesign should feel visually striking while remaining fast to operate on a scanner screen.

## Evidence on Hand

The repository provides working flows, Thai product copy, UI icons, and a shared Excel report format. There is no confirmed logo, imagery, or existing visual brand asset to preserve.

## Product Principles

- Make the active scan and its result impossible to miss.
- Keep every critical touch target and status readable in active warehouse use.
- Confirm successful work clearly and make the next scan immediate.
- Protect shared operational data through the existing authenticated workflows.

## Accessibility & Inclusion

Use high-contrast text, clear status language, keyboard-compatible scanning, visible focus states, and touch targets suitable for handheld use.

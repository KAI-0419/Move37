# App Store Screenshot Mockups

This directory contains HTML mockup templates for creating high-quality app store screenshots.

## How to Use

1. **Open the mockup file**:
   ```bash
   # Navigate to this directory and open in browser
   open mockup-template.html
   # or double-click the file
   ```

2. **Choose your design**:
   - **Design 1**: Hero with Game Board (default) - Best for featuring gameplay
   - **Design 2**: Three Games Showcase - Shows all games at once
   - **Design 3**: Minimal Power - Bold, simple, impactful

   To switch designs, edit `mockup-template.html` and change:
   ```html
   <div class="canvas design-1">  <!-- Change to design-2 or design-3 -->
   ```

3. **Take a screenshot**:
   - **Windows**: Windows + Shift + S, then drag around the canvas
   - **Mac**: Cmd + Shift + 4, then drag around the canvas
   - **Browser**: Right-click on canvas → "Capture Screenshot" (Chrome/Edge)

4. **Verify dimensions**:
   - The canvas is exactly 1024px × 500px
   - If your screenshot is different, crop it to 1024×500

## Customization

### Change Text
Edit the HTML directly. Key sections:
- Main headline: `<div class="headline">CAN YOU BEAT AI?</div>`
- Features: `<div class="feature">Your text here</div>`
- Tagline: `<div class="tagline">Pure Logic Engine</div>`

### Change Colors
Edit the CSS `<style>` section:
- Primary cyan: `#00f3ff`
- Amber: `#ffaa00`
- Crimson: `#ff003c`
- Background: `#050505`

### Add Game Board Details
For Design 1, you can add more chess pieces in the board grid:
- Player pieces: `<span class="piece-player">♔♕♖♗♘♙</span>`
- AI pieces: `<span class="piece-ai">♚♛♜♝♞♟</span>`

## Tips for Best Results

1. **Browser zoom**: Set browser zoom to 100% for accurate dimensions
2. **High DPI display**: Use a retina/4K display for maximum quality
3. **Multiple versions**: Create variations with different headlines/features
4. **Color variants**: Try different difficulty colors (blue/amber/red)
5. **Animation capture**: The glows and pulses animate - screenshot at peak brightness

## Design Variants Explained

### Design 1: Hero with Game Board
- Best for: Showing actual gameplay
- Focus: Game board with glowing pieces
- Use case: Primary store listing image

### Design 2: Three Games Showcase
- Best for: Highlighting variety
- Focus: All three games at once
- Use case: Secondary image showing game diversity

### Design 3: Minimal Power
- Best for: Brand impact
- Focus: Logo and difficulty tiers
- Use case: Simple, bold statement piece

## File Specifications

- **Format**: HTML (self-contained, no external dependencies except Google Fonts)
- **Dimensions**: 1024px × 500px (Google Play Store feature graphic size)
- **Fonts**: Orbitron (logo/headers), Space Mono (body text)
- **Effects**: Scanlines, glows, animations, cyberpunk aesthetic

## Platform Requirements

- **Google Play Store**: 1024×500px (feature graphic) ✓
- **Apple App Store**: Varies by device, you may need to create additional sizes
  - iPhone 6.7": 1290×2796px (screenshot)
  - iPhone 6.5": 1242×2688px (screenshot)
  - iPad Pro 12.9": 2048×2732px (screenshot)

For iOS screenshots, you may want to scale/adapt this template or capture actual device screenshots.

## Need Help?

- Edit colors, text, and layout directly in the HTML file
- All CSS is embedded in the `<style>` section
- Change the `.canvas` class to switch between design variants
- Preview in any modern browser (Chrome, Firefox, Safari, Edge)

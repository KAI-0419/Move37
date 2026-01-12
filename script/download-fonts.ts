// Script to download Space Mono and Orbitron fonts from Google Fonts
// This script fetches the Google Fonts CSS and extracts font file URLs
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const FONTS_DIR = join(process.cwd(), 'client', 'public', 'fonts');

// Font definitions
const FONTS = {
  'Space Mono': {
    weights: [400, 700],
    italic: true,
  },
  'Orbitron': {
    weights: [400, 500, 700, 900],
    italic: false,
  },
};

interface FontFile {
  url: string;
  weight: number;
  style: string;
  filename: string;
}

async function fetchFontCSS(fontFamily: string): Promise<string> {
  const fontName = fontFamily.replace(/\s+/g, '+');
  const fontConfig = FONTS[fontFamily as keyof typeof FONTS];
  const weights = fontConfig.weights.join(';');
  
  // Build Google Fonts CSS URL
  let cssUrl = `https://fonts.googleapis.com/css2?family=${fontName}:wght@${weights}&display=swap`;
  
  // Add italic variants if needed
  if (fontConfig.italic) {
    cssUrl += `&family=${fontName}:ital,wght@0,400;0,700;1,400;1,700`;
  }
  
  console.log(`Fetching CSS for ${fontFamily}...`);
  
  // Use mobile User-Agent to get woff2 format
  const response = await fetch(cssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch CSS: ${response.status} ${response.statusText}`);
  }
  
  return await response.text();
}

function extractFontUrls(css: string, fontFamily: string): FontFile[] {
  const fontFiles: FontFile[] = [];
  
  // Match @font-face blocks (multiline support)
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gs;
  let match;
  
  while ((match = fontFaceRegex.exec(css)) !== null) {
    const block = match[1];
    
    // Extract font-weight
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const weight = weightMatch ? parseInt(weightMatch[1], 10) : 400;
    
    // Extract font-style
    const styleMatch = block.match(/font-style:\s*(normal|italic)/);
    const style = styleMatch ? styleMatch[1] : 'normal';
    
    // Extract src URLs - try woff2 first, then fallback to ttf
    // Match: url(https://...) format('woff2') or url(https://...) format('truetype')
    const srcMatch = block.match(/url\(([^)]+)\)\s+format\(['"](woff2|truetype)['"]\)/);
    if (srcMatch) {
      let url = srcMatch[1].trim();
      const format = srcMatch[2];
      
      // Convert ttf to woff2 if possible
      if (format === 'truetype' && url.includes('.ttf')) {
        // Try to get woff2 version by replacing .ttf with .woff2
        url = url.replace(/\.ttf$/, '.woff2');
      }
      
      const filename = `${fontFamily.replace(/\s+/g, '-')}-${weight}${style === 'italic' ? '-italic' : ''}.woff2`;
      fontFiles.push({ url, weight, style, filename });
    }
  }
  
  return fontFiles;
}

async function downloadFontFile(fontFile: FontFile): Promise<void> {
  try {
    console.log(`  Downloading ${fontFile.filename}...`);
    const response = await fetch(fontFile.url);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const filepath = join(FONTS_DIR, fontFile.filename);
    await writeFile(filepath, Buffer.from(buffer));
    console.log(`  ✓ Saved: ${fontFile.filename}`);
  } catch (error) {
    console.error(`  ✗ Error downloading ${fontFile.filename}:`, error);
    throw error;
  }
}

async function main() {
  console.log('Starting font download...\n');
  
  // Ensure fonts directory exists
  if (!existsSync(FONTS_DIR)) {
    await mkdir(FONTS_DIR, { recursive: true });
  }
  
  // Download fonts for each family
  for (const fontFamily of Object.keys(FONTS)) {
    console.log(`\nProcessing ${fontFamily}...`);
    
    try {
      // Fetch CSS
      const css = await fetchFontCSS(fontFamily);
      
      // Extract font file URLs
      const fontFiles = extractFontUrls(css, fontFamily);
      
      if (fontFiles.length === 0) {
        console.warn(`  ⚠ No font files found in CSS for ${fontFamily}`);
        continue;
      }
      
      // Download each font file
      for (const fontFile of fontFiles) {
        await downloadFontFile(fontFile);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`✗ Error processing ${fontFamily}:`, error);
      throw error;
    }
  }
  
  console.log('\n✓ All fonts downloaded successfully!');
  console.log(`\nFonts saved to: ${FONTS_DIR}`);
}

main().catch(console.error);

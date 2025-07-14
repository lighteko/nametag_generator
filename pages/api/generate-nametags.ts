import { NextApiRequest, NextApiResponse } from 'next';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

// Register Korean font if available
try {
  // Try to register a Korean font - this will work if the font file exists
  // You can download Noto Sans KR and place it in public/fonts/ directory
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansKR-Regular.ttf');
  if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'Noto Sans KR');
    console.log('Korean font registered successfully');
  }
} catch (error) {
  console.log('Korean font not found, using system fonts');
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

interface PersonData {
  성명: string;
  교회: string;
  '나이/학년/직책': string;
  '학생 여부': string;
}

// Convert base64 to buffer
const base64ToBuffer = (base64String: string): Buffer => {
  const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
};

const generateNametagImage = async (
  person: PersonData,
  backgroundImageBuffer: Buffer,
  isSmall: boolean
): Promise<Buffer> => {
  const backgroundImage = await loadImage(backgroundImageBuffer);
  const canvas = createCanvas(backgroundImage.width, backgroundImage.height);
  const ctx = canvas.getContext('2d');

  // Draw background image
  ctx.drawImage(backgroundImage, 0, 0);

  // Set font and text properties - reasonable sizes that won't overflow
  const fontSize = isSmall ? 100 : 180; // Small: bigger but reasonable, Big: larger but contained
  const churchFontSize = isSmall ? 44 : 64; // Small: slightly smaller, Big: same
  const detailFontSize = isSmall ? 60 : 120; // Small: bigger but reasonable, Big: larger but contained
  
  console.log(`Font sizes for ${person.성명} (${isSmall ? 'small' : 'big'}): name=${fontSize}, church=${churchFontSize}, detail=${detailFontSize}`);
  
  // Use Korean-compatible fonts with comprehensive fallbacks
  const koreanFont = '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans CJK KR", "Dotum", "돋움", "Gulim", "굴림", "Batang", "바탕", sans-serif';
  
  // Set text properties with Korean support
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Enable text anti-aliasing for better Korean character rendering
  ctx.imageSmoothingEnabled = true;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Check if church field is empty to adjust layout
  const hasChurch = person.교회 && person.교회.trim() !== '';

  if (hasChurch) {
    // Layout with church field
    // Draw church (교회) - positioned based on nametag size
    ctx.font = `${churchFontSize}px ${koreanFont}`;
    ctx.textAlign = 'left'; // Align to left for church
    // Small: left margin, Big: slightly more right and higher
    const leftMargin = isSmall ? canvas.width * 0.1 : canvas.width * 0.15; // 10% vs 15% from left
    const churchY = isSmall ? centerY - 60 : centerY - 150; // Big: higher position
    ctx.fillText(person.교회, leftMargin, churchY);

    // Draw name (성명) - centered, positioned much lower
    ctx.font = `bold ${fontSize}px ${koreanFont}`;
    ctx.textAlign = 'center'; // Back to center for name
    // Small: higher position, Big: much lower
    const nameY = isSmall ? centerY + 20 : centerY + 80;
    ctx.fillText(person.성명, centerX, nameY);

    // Draw age/grade/position (나이/학년/직책) - different gaps for students vs non-students
    ctx.font = `${detailFontSize}px ${koreanFont}`;
    // Small (students): smaller gap and higher, Big (non-students): bigger gap
    const detailY = isSmall ? centerY + 120 : centerY + 280;
    ctx.fillText(person['나이/학년/직책'], centerX, detailY);
  } else {
    // Layout without church field - center the content better
    // Draw name (성명) - positioned much lower
    ctx.font = `bold ${fontSize}px ${koreanFont}`;
    ctx.textAlign = 'center';
    // Small: higher position, Big: much lower
    const nameY = isSmall ? centerY - 20 : centerY + 40;
    ctx.fillText(person.성명, centerX, nameY);

    // Draw age/grade/position (나이/학년/직책) - different gaps for students vs non-students
    ctx.font = `${detailFontSize}px ${koreanFont}`;
    // Small (students): smaller gap and higher, Big (non-students): bigger gap
    const detailY = isSmall ? centerY + 80 : centerY + 240;
    ctx.fillText(person['나이/학년/직책'], centerX, detailY);
  }

  return canvas.toBuffer('image/png');
};

const generateArrangedA4Pages = async (
  personData: PersonData[],
  bigNametagFiles: any[],
  smallNametagFiles: any[],
  studentWidthMm: number,
  nonStudentWidthMm: number
): Promise<Buffer[]> => {
  // A4 dimensions in pixels at 300 DPI
  const A4_WIDTH = 2480; // 210mm at 300 DPI
  const A4_HEIGHT = 3508; // 297mm at 300 DPI
  
  // Convert mm to pixels (300 DPI)
  const mmToPixels = (mm: number) => Math.round(mm * 300 / 25.4);
  
  // Calculate margins and grid
  const margin = mmToPixels(10); // 10mm margin
  const gridSpacing = mmToPixels(2); // 2mm grid spacing
  
  const availableWidth = A4_WIDTH - 2 * margin;
  const availableHeight = A4_HEIGHT - 2 * margin;
  
  // Separate students and non-students
  const students = personData.filter(p => p['학생 여부'] === 'T');
  const nonStudents = personData.filter(p => p['학생 여부'] !== 'T');
  
  const pages: Buffer[] = [];
  
  // Generate pages for students
  if (students.length > 0 && smallNametagFiles.length > 0) {
    // Get the actual dimensions from the first small nametag file
    const firstSmallImageBuffer = base64ToBuffer(smallNametagFiles[0].data);
    const firstSmallImage = await loadImage(firstSmallImageBuffer);
    const smallImageAspectRatio = firstSmallImage.height / firstSmallImage.width;
    
    const studentWidthPx = mmToPixels(studentWidthMm);
    const studentHeightPx = Math.round(studentWidthPx * smallImageAspectRatio); // Use actual aspect ratio
    
    const studentCols = Math.floor(availableWidth / (studentWidthPx + gridSpacing));
    const studentRows = Math.floor(availableHeight / (studentHeightPx + gridSpacing));
    
    console.log(`Student layout: ${studentCols} cols x ${studentRows} rows, nametag size: ${studentWidthPx}x${studentHeightPx}px (aspect ratio: ${smallImageAspectRatio.toFixed(2)})`);
    
    const studentPages = await generateArrangedPages(
      students, 
      smallNametagFiles, 
      true, 
      studentCols, 
      studentRows, 
      studentWidthPx, 
      studentHeightPx, 
      margin, 
      gridSpacing,
      A4_WIDTH,
      A4_HEIGHT
    );
    pages.push(...studentPages);
  }
  
  // Generate pages for non-students
  if (nonStudents.length > 0 && bigNametagFiles.length > 0) {
    // Get the actual dimensions from the first big nametag file
    const firstBigImageBuffer = base64ToBuffer(bigNametagFiles[0].data);
    const firstBigImage = await loadImage(firstBigImageBuffer);
    const bigImageAspectRatio = firstBigImage.height / firstBigImage.width;
    
    const nonStudentWidthPx = mmToPixels(nonStudentWidthMm);
    const nonStudentHeightPx = Math.round(nonStudentWidthPx * bigImageAspectRatio); // Use actual aspect ratio
    
    const nonStudentCols = Math.floor(availableWidth / (nonStudentWidthPx + gridSpacing));
    const nonStudentRows = Math.floor(availableHeight / (nonStudentHeightPx + gridSpacing));
    
    console.log(`Non-student layout: ${nonStudentCols} cols x ${nonStudentRows} rows, nametag size: ${nonStudentWidthPx}x${nonStudentHeightPx}px (aspect ratio: ${bigImageAspectRatio.toFixed(2)})`);
    
    const nonStudentPages = await generateArrangedPages(
      nonStudents, 
      bigNametagFiles, 
      false, 
      nonStudentCols, 
      nonStudentRows, 
      nonStudentWidthPx, 
      nonStudentHeightPx, 
      margin, 
      gridSpacing,
      A4_WIDTH,
      A4_HEIGHT
    );
    pages.push(...nonStudentPages);
  }
  
  return pages;
};

interface NametagPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  person?: PersonData;
  isBlank?: boolean;
}

const optimizedPackNametags = (
  nametagWidthPx: number,
  nametagHeightPx: number,
  availableWidth: number,
  availableHeight: number,
  totalNametags: number,
  gridSpacing: number
): NametagPlacement[] => {
  const placements: NametagPlacement[] = [];
  const usedAreas: { x: number; y: number; width: number; height: number }[] = [];
  
  const isAreaFree = (x: number, y: number, width: number, height: number): boolean => {
    for (const area of usedAreas) {
      if (!(x >= area.x + area.width || x + width <= area.x || 
            y >= area.y + area.height || y + height <= area.y)) {
        return false;
      }
    }
    return true;
  };
  
  const addPlacement = (x: number, y: number, width: number, height: number, rotated: boolean) => {
    placements.push({ x, y, width, height, rotated });
    usedAreas.push({ x, y, width, height });
  };
  
  // Try to place nametags with rotation optimization
  for (let i = 0; i < totalNametags; i++) {
    let placed = false;
    
    // Try both orientations
    const orientations = [
      { w: nametagWidthPx, h: nametagHeightPx, rotated: false },
      { w: nametagHeightPx, h: nametagWidthPx, rotated: true }
    ];
    
    for (const orientation of orientations) {
      if (placed) break;
      
      // Try to find a position for this orientation
      for (let y = 0; y <= availableHeight - orientation.h; y += Math.min(10, orientation.h)) {
        if (placed) break;
        
        for (let x = 0; x <= availableWidth - orientation.w; x += Math.min(10, orientation.w)) {
          if (isAreaFree(x, y, orientation.w + gridSpacing, orientation.h + gridSpacing)) {
            addPlacement(x, y, orientation.w, orientation.h, orientation.rotated);
            placed = true;
            break;
          }
        }
      }
    }
    
    if (!placed) {
      // Can't fit more nametags on this page
      break;
    }
  }
  
  return placements;
};

const generateArrangedPages = async (
  people: PersonData[],
  nametagFiles: any[],
  isStudent: boolean,
  cols: number,
  rows: number,
  nametagWidthPx: number,
  nametagHeightPx: number,
  margin: number,
  gridSpacing: number,
  pageWidth: number,
  pageHeight: number
): Promise<Buffer[]> => {
  const pages: Buffer[] = [];
  const spareCount = isStudent ? 10 : 0;
  const totalNametags = people.length + spareCount;
  
  const availableWidth = pageWidth - 2 * margin;
  const availableHeight = pageHeight - 2 * margin;
  
  // Convert mm to pixels (300 DPI)
  const mmToPixels = (mm: number) => Math.round(mm * 300 / 25.4);
  
  // 1mm border in pixels
  const borderPx = mmToPixels(1);
  
  let processedNametags = 0;
  
  while (processedNametags < totalNametags) {
    // Use optimized packing for remaining nametags
    const remainingNametags = totalNametags - processedNametags;
    const placements = optimizedPackNametags(
      nametagWidthPx,
      nametagHeightPx,
      availableWidth,
      availableHeight,
      remainingNametags,
      gridSpacing
    );
    
    if (placements.length === 0) {
      // Fallback: at least try to place one nametag
      const fallbackPlacement: NametagPlacement = {
        x: 0,
        y: 0,
        width: nametagWidthPx,
        height: nametagHeightPx,
        rotated: false
      };
      placements.push(fallbackPlacement);
    }
    
    console.log(`Page ${Math.floor(processedNametags / (cols * rows)) + 1}: Placed ${placements.length} nametags using optimized packing`);
    
    const canvas = createCanvas(pageWidth, pageHeight);
    const ctx = canvas.getContext('2d');
    
        // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    
    // Draw guideline grid (reference grid)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    
    // Calculate grid for reference (using original dimensions)
    const gridCols = Math.floor(availableWidth / (nametagWidthPx + gridSpacing));
    const gridRows = Math.floor(availableHeight / (nametagHeightPx + gridSpacing));
    
    // Draw horizontal grid lines
    for (let row = 0; row <= gridRows; row++) {
      const y = margin + row * (nametagHeightPx + gridSpacing);
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(pageWidth - margin, y);
      ctx.stroke();
    }
    
    // Draw vertical grid lines
    for (let col = 0; col <= gridCols; col++) {
      const x = margin + col * (nametagWidthPx + gridSpacing);
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, pageHeight - margin);
      ctx.stroke();
    }
      
      // Draw cutting lines around each nametag (darker)
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 1;
      
      for (let i = 0; i < placements.length; i++) {
        const placement = placements[i];
        const nametagIndex = processedNametags + i;
        
        if (nametagIndex >= totalNametags) break;
        
        const actualX = margin + placement.x;
        const actualY = margin + placement.y;
        
        // Draw cutting lines (outer boundary)
        ctx.strokeRect(actualX, actualY, placement.width, placement.height);
        
        // Draw 1mm border/outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(actualX + borderPx, actualY + borderPx, placement.width - 2 * borderPx, placement.height - 2 * borderPx);
        
        // Reset cutting line style
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        
        // Calculate image area (inside the border)
        const imageX = actualX + borderPx;
        const imageY = actualY + borderPx;
        const imageWidth = placement.width - 2 * borderPx;
        const imageHeight = placement.height - 2 * borderPx;
        
        // Generate and place nametag
        if (nametagIndex < people.length) {
          // Regular nametag
          const person = people[nametagIndex];
          const randomIndex = Math.floor(Math.random() * nametagFiles.length);
          const selectedFile = nametagFiles[randomIndex];
          
          const imageBuffer = base64ToBuffer(selectedFile.data);
          const nametagBuffer = await generateNametagImage(person, imageBuffer, isStudent);
          const nametagImage = await loadImage(nametagBuffer);
          
          if (placement.rotated) {
            // Rotate the image 90 degrees
            ctx.save();
            ctx.translate(imageX + imageWidth / 2, imageY + imageHeight / 2);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(nametagImage, -imageHeight / 2, -imageWidth / 2, imageHeight, imageWidth);
            ctx.restore();
          } else {
            ctx.drawImage(nametagImage, imageX, imageY, imageWidth, imageHeight);
          }
        } else {
          // Spare nametag (blank)
          const randomIndex = Math.floor(Math.random() * nametagFiles.length);
          const selectedFile = nametagFiles[randomIndex];
          
          const imageBuffer = base64ToBuffer(selectedFile.data);
          const blankImage = await loadImage(imageBuffer);
          
          if (placement.rotated) {
            // Rotate the image 90 degrees
            ctx.save();
            ctx.translate(imageX + imageWidth / 2, imageY + imageHeight / 2);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(blankImage, -imageHeight / 2, -imageWidth / 2, imageHeight, imageWidth);
            ctx.restore();
          } else {
            ctx.drawImage(blankImage, imageX, imageY, imageWidth, imageHeight);
          }
        }
      }
    
    pages.push(canvas.toBuffer('image/png'));
    processedNametags += placements.length;
  }
  
  return pages;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('API called with method:', req.method);
  
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'API is working' });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Processing request body...');
    const { personData, bigNametagFiles, smallNametagFiles, useArrangedLayout, studentWidthMm, nonStudentWidthMm } = req.body;
    
    console.log('Person data:', personData.length, 'people');
    console.log('Big nametag files:', bigNametagFiles.length);
    console.log('Small nametag files:', smallNametagFiles.length);
    console.log('Use arranged layout:', useArrangedLayout);
    console.log('Student width (mm):', studentWidthMm);
    console.log('Non-student width (mm):', nonStudentWidthMm);

    // Create ZIP file
    console.log('Creating ZIP file...');
    const zip = new JSZip();
    
    if (useArrangedLayout) {
      // Generate arranged A4 pages
      console.log('Generating arranged A4 pages...');
      const pages = await generateArrangedA4Pages(
        personData,
        bigNametagFiles,
        smallNametagFiles,
        studentWidthMm,
        nonStudentWidthMm
      );
      
      console.log(`Generated ${pages.length} A4 pages`);
      
      // Add pages to ZIP
      pages.forEach((pageBuffer, index) => {
        const filename = `A4_Page_${index + 1}.png`;
        zip.file(filename, new Uint8Array(pageBuffer));
        console.log(`Added ${filename} to ZIP`);
      });
      
    } else {
      // Generate individual files
      console.log('Processing each person...');
      for (const person of personData) {
        console.log(`Processing person: ${person.성명}`);
        const isStudent = person['학생 여부'] === 'T';
        const nametagFiles = isStudent ? smallNametagFiles : bigNametagFiles;
        
        if (nametagFiles.length === 0) {
          console.warn(`No ${isStudent ? 'small' : 'big'} nametag files available for ${person.성명}`);
          continue;
        }
        
        // Randomly select a background image
        const randomIndex = Math.floor(Math.random() * nametagFiles.length);
        const selectedFile = nametagFiles[randomIndex];
        console.log(`Selected file for ${person.성명}`);
        
        // Generate nametag image
        console.log(`Generating nametag for ${person.성명}...`);
        const imageBuffer = base64ToBuffer(selectedFile.data);
        const nametagBuffer = await generateNametagImage(
          person,
          imageBuffer,
          isStudent
        );
        console.log(`Nametag generated for ${person.성명}`);
        
        // Add to ZIP with filename
        const churchPart = person.교회 && person.교회.trim() !== '' ? `_${person.교회}` : '';
        const filename = `${person.성명}${churchPart}_${isStudent ? 'small' : 'big'}.png`;
        zip.file(filename, new Uint8Array(nametagBuffer));
        console.log(`Added ${filename} to ZIP`);
      }
    }

    // Generate ZIP buffer
    console.log('Generating ZIP buffer...');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log('ZIP buffer generated, size:', zipBuffer.length);
    
    // Set response headers
    console.log('Setting response headers...');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="LFC_교육_선교_이름표.zip"');
    res.setHeader('Content-Length', zipBuffer.length);
    
    // Send ZIP file
    console.log('Sending ZIP file...');
    res.send(zipBuffer);
    console.log('ZIP file sent successfully');
    
  } catch (error) {
    console.error('Error generating nametags:', error);
    res.status(500).json({ error: 'Failed to generate nametags' });
  }
} 
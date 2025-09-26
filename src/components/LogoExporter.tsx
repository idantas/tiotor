import React, { useRef, useState, useMemo } from 'react';
import { TioAvatar } from './TioAvatar';
import { TioTorSVG, getTioTorSVGString } from './TioTorSVG';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Download, ArrowLeft, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface LogoExporterProps {
  onBack: () => void;
}

export function LogoExporter({ onBack }: LogoExporterProps) {
  const [copiedSvg, setCopiedSvg] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Memoize the logo variants to prevent re-renders
  const logoVariants = useMemo(() => [
    {
      key: 'minimal' as const,
      title: 'Minimal',
      description: 'Clean avatar with core elements only',
      preview: <TioTorSVG size={80} variant="minimal" className="mx-auto" />
    },
    {
      key: 'full' as const,
      title: 'Full Avatar',
      description: 'Complete avatar with wave effects',
      preview: <TioTorSVG size={80} variant="full" className="mx-auto" />
    },
    {
      key: 'brand' as const,
      title: 'Brand Logo',
      description: 'Avatar with Tio Tor branding text',
      preview: <TioTorSVG size={80} variant="brand" className="mx-auto" />
    }
  ], []);

  // Memoize export sizes
  const exportSizes = useMemo(() => [
    { size: 48, label: '48px', description: 'Icon size' },
    { size: 64, label: '64px', description: 'Small logo' },
    { size: 128, label: '128px', description: 'Medium logo' },
    { size: 200, label: '200px', description: 'Large logo' },
    { size: 512, label: '512px', description: 'High-res' }
  ], []);

  // Download SVG file
  const downloadSVG = (variant: 'minimal' | 'full' | 'brand' = 'minimal', size: number = 200) => {
    const svgContent = getTioTorSVGString(size, variant);
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tio-tor-${variant}-${size}px.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download PNG file (by converting SVG to canvas)
  const downloadPNG = async (variant: 'minimal' | 'full' | 'brand' = 'minimal', size: number = 200) => {
    try {
      const svgContent = getTioTorSVGString(size, variant);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas context not available');
      }
      
      const img = new Image();
      
      canvas.width = size;
      canvas.height = size;
      
      return new Promise<void>((resolve, reject) => {
        // Set a timeout for image loading
        const timeout = setTimeout(() => {
          reject(new Error('Image loading timeout'));
        }, 10000);

        img.onload = () => {
          clearTimeout(timeout);
          try {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `tio-tor-${variant}-${size}px.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                resolve();
              } else {
                reject(new Error('Failed to create blob'));
              }
            }, 'image/png');
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load SVG image'));
        };
        
        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        img.src = url;
      });
    } catch (error) {
      console.error('Error downloading PNG:', error);
      // Fallback: just download the SVG instead
      downloadSVG(variant, size);
    }
  };

  // Copy SVG code to clipboard
  const copySVGCode = async (variant: 'minimal' | 'full' | 'brand' = 'minimal') => {
    const svgContent = getTioTorSVGString(200, variant);
    await navigator.clipboard.writeText(svgContent);
    setCopiedSvg(true);
    setTimeout(() => setCopiedSvg(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-medium">Tio Tor Logo Exporter</h1>
            <p className="text-muted-foreground">Download the Tio Tor avatar in vector and raster formats</p>
          </div>
        </div>

        {/* Live Preview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>Static SVG versions vs Interactive avatar states</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              {/* Static SVG Variants */}
              <div>
                <h4 className="text-sm font-medium mb-4 text-center">Static SVG Variants</h4>
                <div className="flex justify-center gap-6">
                  <div className="text-center space-y-2">
                    <TioTorSVG size={60} variant="minimal" className="mx-auto" />
                    <Badge variant="secondary" className="text-xs">Minimal</Badge>
                  </div>
                  <div className="text-center space-y-2">
                    <TioTorSVG size={60} variant="full" className="mx-auto" />
                    <Badge variant="secondary" className="text-xs">Full</Badge>
                  </div>
                  <div className="text-center space-y-2">
                    <TioTorSVG size={60} variant="brand" className="mx-auto" />
                    <Badge variant="secondary" className="text-xs">Brand</Badge>
                  </div>
                </div>
              </div>
              
              {/* Interactive Avatar States */}
              <div>
                <h4 className="text-sm font-medium mb-4 text-center">Interactive Avatar States</h4>
                <div className="flex justify-center gap-6">
                  <div className="text-center space-y-2">
                    <TioAvatar state="idle" size="md" />
                    <Badge variant="outline" className="text-xs">Idle</Badge>
                  </div>
                  <div className="text-center space-y-2">
                    <TioAvatar state="speaking" size="md" />
                    <Badge variant="outline" className="text-xs">Speaking</Badge>
                  </div>
                  <div className="text-center space-y-2">
                    <TioAvatar state="listening" size="md" />
                    <Badge variant="outline" className="text-xs">Listening</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logo Variants */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {logoVariants.map((variant) => (
            <Card key={variant.key}>
              <CardHeader>
                <CardTitle className="text-lg">{variant.title}</CardTitle>
                <CardDescription>{variant.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview */}
                <div className="flex justify-center py-6 bg-muted/30 rounded-lg">
                  {variant.preview}
                </div>

                <Separator />

                {/* Vector Downloads */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Vector (SVG)</p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => downloadSVG(variant.key)}
                      className="flex-1"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      SVG
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copySVGCode(variant.key)}
                    >
                      {copiedSvg ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>

                {/* Raster Downloads */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Raster (PNG)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {exportSizes.slice(0, 4).map((sizeOption) => (
                      <Button
                        key={sizeOption.size}
                        size="sm"
                        variant="outline"
                        onClick={() => downloadPNG(variant.key, sizeOption.size)}
                        className="text-xs"
                      >
                        {sizeOption.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* High Resolution Downloads */}
        <Card>
          <CardHeader>
            <CardTitle>High Resolution Downloads</CardTitle>
            <CardDescription>For print and high-DPI displays</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {logoVariants.map((variant) => (
                <div key={`hr-${variant.key}`} className="space-y-3">
                  <h4 className="font-medium">{variant.title}</h4>
                  <div className="space-y-2">
                    <Button
                      onClick={() => downloadPNG(variant.key, 512)}
                      variant="outline"
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      512px PNG
                    </Button>
                    <Button
                      onClick={() => downloadPNG(variant.key, 1024)}
                      variant="outline"
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      1024px PNG
                    </Button>
                    <Button
                      onClick={() => downloadSVG(variant.key, 1024)}
                      variant="outline"
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Vector SVG
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Usage Guidelines */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Usage Guidelines</CardTitle>
            <CardDescription>Best practices for using the Tio Tor logo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Vector Format (SVG)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Best for web and scalable applications</li>
                  <li>• Perfect quality at any size</li>
                  <li>• Smallest file size</li>
                  <li>• Supports CSS styling</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Raster Format (PNG)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Best for presentations and documents</li>
                  <li>• Use 2x size for high-DPI displays</li>
                  <li>• Transparent background included</li>
                  <li>• Use 512px+ for print materials</li>
                </ul>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="font-medium mb-2">Logo Variants</h4>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div>
                  <strong>Minimal:</strong> Use for favicons, small icons, and minimal interfaces
                </div>
                <div>
                  <strong>Full Avatar:</strong> Use for app headers, profile images, and main branding
                </div>
                <div>
                  <strong>Brand Logo:</strong> Use for marketing materials, business cards, and presentations
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
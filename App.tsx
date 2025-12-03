import React, { useState, useRef, useEffect } from 'react';
import { AppMode, CaptionSuggestion, AnalysisResult } from './types';
import { generateMagicCaptions, editImageWithGemini, analyzeImageContent } from './services/geminiService';
import { IconMagic, IconEdit, IconAnalyze, IconUpload, IconDownload } from './components/Icons';
import { Button } from './components/Button';

// Placeholder/Template images
const TEMPLATES = [
  "https://picsum.photos/id/1025/600/600",
  "https://picsum.photos/id/1074/600/600",
  "https://picsum.photos/id/237/600/600",
  "https://picsum.photos/id/1062/600/600"
];

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.CAPTION);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Caption State
  const [captions, setCaptions] = useState<CaptionSuggestion[]>([]);
  const [selectedCaption, setSelectedCaption] = useState<string>("");
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");

  // Edit State
  const [editPrompt, setEditPrompt] = useState("");
  
  // Analysis State
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Image Handling ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageSrc(event.target.result as string);
          resetState();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const selectTemplate = async (url: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
        setIsLoading(false);
        resetState();
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setError("Failed to load template");
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setCaptions([]);
    setSelectedCaption("");
    setTopText("");
    setBottomText("");
    setEditPrompt("");
    setAnalysis(null);
    setError(null);
  };

  // --- Drawing to Canvas ---

  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      // Calculate aspect ratio fit within max dimensions (e.g., 600x600)
      const maxDim = 600;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      // Draw Text
      if (mode === AppMode.CAPTION) {
        const displayText = selectedCaption || (topText + (bottomText ? `\n${bottomText}` : ""));
        
        if (displayText) {
          const lines = displayText.split('\n');
          const fontSize = Math.floor(width / 10);
          ctx.font = `900 ${fontSize}px Impact, sans-serif`;
          ctx.fillStyle = 'white';
          ctx.strokeStyle = 'black';
          ctx.lineWidth = Math.floor(fontSize / 8);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          // Simple logic: if manually entered top/bottom, use fixed positions.
          // If magic caption (selectedCaption), center it or place it at bottom if long.
          
          if (topText || bottomText) {
             if (topText) {
                ctx.strokeText(topText.toUpperCase(), width / 2, 10);
                ctx.fillText(topText.toUpperCase(), width / 2, 10);
             }
             if (bottomText) {
                ctx.textBaseline = 'bottom';
                ctx.strokeText(bottomText.toUpperCase(), width / 2, height - 10);
                ctx.fillText(bottomText.toUpperCase(), width / 2, height - 10);
             }
          } else if (selectedCaption) {
              // Magic caption rendering (multi-line wrapping)
              const words = selectedCaption.split(' ');
              let line = '';
              const lineArray: string[] = [];
              
              for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > width - 40 && n > 0) {
                  lineArray.push(line);
                  line = words[n] + ' ';
                } else {
                  line = testLine;
                }
              }
              lineArray.push(line);

              // Draw at the bottom
              ctx.textBaseline = 'bottom';
              let y = height - 20 - (lineArray.length - 1) * fontSize;
              
              lineArray.forEach((l, i) => {
                  ctx.strokeText(l.toUpperCase(), width / 2, y + (i * fontSize * 1.1));
                  ctx.fillText(l.toUpperCase(), width / 2, y + (i * fontSize * 1.1));
              });
          }
        }
      }
    };
  }, [imageSrc, selectedCaption, topText, bottomText, mode]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = 'meme-gen-ai.png';
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  // --- AI Actions ---

  const handleMagicCaption = async () => {
    if (!imageSrc) return;
    setIsLoading(true);
    setError(null);
    try {
      const suggestions = await generateMagicCaptions(imageSrc);
      setCaptions(suggestions);
    } catch (err: any) {
      setError(err.message || "Failed to generate captions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditImage = async () => {
    if (!imageSrc || !editPrompt) return;
    setIsLoading(true);
    setError(null);
    try {
      const newImageBase64 = await editImageWithGemini(imageSrc, editPrompt);
      setImageSrc(newImageBase64);
      setEditPrompt(""); // Clear prompt after success
    } catch (err: any) {
      setError(err.message || "Failed to edit image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!imageSrc) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeImageContent(imageSrc);
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || "Failed to analyze image");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Helpers ---

  const renderTabs = () => (
    <div className="flex p-1 space-x-1 bg-slate-800/50 rounded-xl mb-6 backdrop-blur-sm border border-slate-700">
      <button
        onClick={() => setMode(AppMode.CAPTION)}
        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
          mode === AppMode.CAPTION ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }`}
      >
        <IconMagic /> Caption
      </button>
      <button
        onClick={() => setMode(AppMode.EDIT)}
        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
          mode === AppMode.EDIT ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }`}
      >
        <IconEdit /> Edit
      </button>
      <button
        onClick={() => setMode(AppMode.ANALYZE)}
        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
          mode === AppMode.ANALYZE ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }`}
      >
        <IconAnalyze /> Analyze
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 pb-20">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">M</div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              MemeGen AI
            </h1>
          </div>
          {imageSrc && (
            <Button onClick={handleDownload} variant="ghost" className="hidden sm:flex">
              <IconDownload /> Download
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!imageSrc ? (
          // Empty State / Upload
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">
            <div className="w-full max-w-lg bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center hover:border-indigo-500 hover:bg-slate-900 transition-all cursor-pointer group"
                 onClick={() => fileInputRef.current?.click()}>
              <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <IconUpload />
              </div>
              <h2 className="text-2xl font-bold mb-2">Upload an image</h2>
              <p className="text-slate-400 mb-6">Drag and drop or click to select</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*" 
              />
              <Button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                Select File
              </Button>
            </div>

            <div className="mt-10 w-full max-w-2xl">
              <p className="text-slate-400 text-sm font-medium mb-4 text-center uppercase tracking-wider">Or start with a template</p>
              <div className="grid grid-cols-4 gap-4">
                {TEMPLATES.map((t, i) => (
                  <button 
                    key={i}
                    onClick={() => selectTemplate(t)}
                    className="relative aspect-square rounded-xl overflow-hidden hover:ring-4 ring-indigo-500 transition-all group"
                  >
                    <img src={t} alt={`Template ${i}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    {isLoading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center">...</div>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Workspace
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: Canvas Area */}
            <div className="lg:col-span-3 flex flex-col gap-4">
               <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 flex items-center justify-center min-h-[400px] shadow-2xl">
                 <canvas ref={canvasRef} className="max-w-full h-auto rounded-lg shadow-lg" />
               </div>
               
               {/* Mobile Action Buttons */}
               <div className="flex gap-2 lg:hidden">
                 <Button onClick={() => setImageSrc(null)} variant="secondary" className="flex-1">New Image</Button>
                 <Button onClick={handleDownload} className="flex-1">Download</Button>
               </div>
            </div>

            {/* Right: Controls */}
            <div className="lg:col-span-2">
              <div className="sticky top-24 space-y-6">
                
                {renderTabs()}

                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-lg min-h-[400px]">
                  
                  {/* Mode: Caption */}
                  {mode === AppMode.CAPTION && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="space-y-3">
                         <h3 className="font-semibold text-lg">AI Magic Caption</h3>
                         <p className="text-slate-400 text-sm">Let Gemini 3 Pro analyze the image and write the jokes for you.</p>
                         <Button 
                           onClick={handleMagicCaption} 
                           isLoading={isLoading} 
                           className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                          >
                           <IconMagic /> Generate Captions
                         </Button>
                      </div>

                      {captions.length > 0 && (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Suggestions</p>
                          {captions.map((cap, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedCaption(cap.text);
                                setTopText("");
                                setBottomText("");
                              }}
                              className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                                selectedCaption === cap.text 
                                  ? "bg-indigo-600/20 border-indigo-500 text-white" 
                                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span>{cap.text}</span>
                                <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 whitespace-nowrap">{cap.category}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="border-t border-slate-800 pt-6">
                         <p className="text-xs font-bold text-slate-500 uppercase mb-3">Manual Text</p>
                         <div className="space-y-3">
                           <input 
                             type="text" 
                             placeholder="Top Text" 
                             value={topText}
                             onChange={(e) => {
                               setTopText(e.target.value);
                               setSelectedCaption("");
                             }}
                             className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                           />
                           <input 
                             type="text" 
                             placeholder="Bottom Text" 
                             value={bottomText}
                             onChange={(e) => {
                               setBottomText(e.target.value);
                               setSelectedCaption("");
                             }}
                             className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                           />
                         </div>
                      </div>
                    </div>
                  )}

                  {/* Mode: Edit */}
                  {mode === AppMode.EDIT && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">AI Image Editor</h3>
                        <p className="text-slate-400 text-sm">Powered by Gemini 2.5 Flash (Nano Banana). Describe how you want to change the image.</p>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Instructions</label>
                        <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          placeholder="e.g., 'Make it look like a vintage poster', 'Add a cat in the background', 'Turn it into a pixel art style'"
                          className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                        />
                      </div>

                      <Button 
                        onClick={handleEditImage} 
                        isLoading={isLoading} 
                        disabled={!editPrompt.trim()}
                        className="w-full py-3"
                      >
                         <IconEdit /> Apply Edits
                      </Button>
                      
                      <p className="text-xs text-slate-500 italic mt-2">Note: This will replace your current image with the generated one.</p>
                    </div>
                  )}

                  {/* Mode: Analyze */}
                  {mode === AppMode.ANALYZE && (
                    <div className="space-y-6 animate-fade-in">
                       <div className="space-y-3">
                        <h3 className="font-semibold text-lg">Image Analysis</h3>
                        <p className="text-slate-400 text-sm">Powered by Gemini 3 Pro. Get a deep understanding of the visual context.</p>
                        <Button 
                          onClick={handleAnalyzeImage} 
                          isLoading={isLoading} 
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700"
                        >
                           <IconAnalyze /> Analyze Image
                        </Button>
                      </div>

                      {analysis && (
                        <div className="space-y-4 bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                           <div>
                             <p className="text-xs font-bold text-slate-500 uppercase mb-1">Description</p>
                             <p className="text-sm leading-relaxed text-slate-200">{analysis.description}</p>
                           </div>
                           <div>
                             <p className="text-xs font-bold text-slate-500 uppercase mb-2">Tags</p>
                             <div className="flex flex-wrap gap-2">
                               {analysis.tags.map((tag, i) => (
                                 <span key={i} className="px-2 py-1 rounded bg-slate-700 text-xs text-slate-300 border border-slate-600">
                                   #{tag}
                                 </span>
                               ))}
                             </div>
                           </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Display */}
                  {error && (
                    <div className="mt-4 p-3 bg-red-900/50 border border-red-800 text-red-200 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                </div>
                
                {/* Desktop Reset Button */}
                <div className="hidden lg:block pt-4">
                   <button 
                     onClick={() => setImageSrc(null)}
                     className="text-slate-500 hover:text-white text-sm flex items-center gap-2 mx-auto transition-colors"
                   >
                     ← Start over with new image
                   </button>
                </div>

              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

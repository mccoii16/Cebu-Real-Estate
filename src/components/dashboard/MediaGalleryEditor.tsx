import React, { useState } from 'react';
import {
  Upload,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Star,
  Plus,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import {
  reorderGalleryImages,
  setGalleryCoverImage,
  removeGalleryImage,
  isValidOptionalHttpUrl,
} from '../../utils/contentManagement';

export interface PresetMediaAsset {
  label: string;
  url: string;
}

interface MediaGalleryEditorProps {
  title?: string;
  images: string[];
  onChange: (nextImages: string[]) => void;
  onUploadFiles: (files: File[]) => Promise<string[]>;
  onRemoveUrl?: (removedUrl: string) => void;
  maxImages?: number;
  presetAssets?: PresetMediaAsset[];
  coverBadgeLabel?: string;
  emptyHint?: string;
}

export const MediaGalleryEditor: React.FC<MediaGalleryEditorProps> = ({
  title = 'Images & Gallery',
  images,
  onChange,
  onUploadFiles,
  onRemoveUrl,
  maxImages = 24,
  presetAssets = [
    { label: 'Skyline Clean', url: '/assets/extracted/hero_skyline_clean.png' },
    { label: 'The Alcoves', url: '/assets/extracted/photo_the_alcoves.png' },
    { label: '38 Park Avenue', url: '/assets/extracted/photo_park_avenue.png' },
    { label: 'Mactan Newtown', url: '/assets/extracted/loc_mactan.png' },
    { label: 'Banilad Enclave', url: '/assets/extracted/loc_banilad.png' },
    { label: 'Astra Centre', url: '/assets/extracted/astra_centre.png' },
  ],
  coverBadgeLabel = 'Primary Cover',
  emptyHint = 'Upload photos, paste an image URL, or pick a Cebu showcase asset below.',
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    if (images.length >= maxImages) {
      setUploadError(`Maximum of ${maxImages} images reached.`);
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const remaining = Math.max(1, maxImages - images.length);
      const uploadedUrls = await onUploadFiles(files.slice(0, remaining));
      if (uploadedUrls.length > 0) {
        onChange([...images, ...uploadedUrls].slice(0, maxImages));
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload image to Firebase Storage.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddUrl = () => {
    const clean = urlInput.trim();
    if (!clean) return;
    setUploadError(null);

    if (!clean.startsWith('/') && !isValidOptionalHttpUrl(clean)) {
      setUploadError('Please enter a valid https://, http://, or /assets/ image path.');
      return;
    }
    if (images.length >= maxImages) {
      setUploadError(`Maximum of ${maxImages} images reached.`);
      return;
    }
    if (!images.includes(clean)) {
      onChange([...images, clean]);
    }
    setUrlInput('');
  };

  const handleMove = (fromIdx: number, toIdx: number) => {
    onChange(reorderGalleryImages(images, fromIdx, toIdx));
  };

  const handlePromoteCover = (idx: number) => {
    onChange(setGalleryCoverImage(images, idx));
  };

  const handleRemove = (idx: number) => {
    const removed = images[idx];
    onChange(removeGalleryImage(images, idx));
    if (removed && onRemoveUrl) {
      onRemoveUrl(removed);
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
          <span>
            {title} ({images.length}/{maxImages})
          </span>
        </span>

        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl bg-[#C6A878] hover:bg-[#b89764] text-[#17243B] text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0">
          <Upload className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{isUploading ? 'Uploading...' : 'Upload Photos'}</span>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {uploadError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Paste Image URL */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddUrl();
            }
          }}
          placeholder="Paste https:// or /assets/... image URL"
          className="flex-1 h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
        />
        <button
          type="button"
          onClick={handleAddUrl}
          className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Add Image URL</span>
        </button>
      </div>

      {/* Quick Presets */}
      {presetAssets.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold text-slate-500 block mb-1.5">
            Quick Add Showcase Assets:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {presetAssets.map((asset) => (
              <button
                key={asset.url}
                type="button"
                onClick={() => {
                  if (!images.includes(asset.url) && images.length < maxImages) {
                    onChange([...images, asset.url]);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors whitespace-nowrap ${
                  images.includes(asset.url)
                    ? 'bg-[#17243B] text-[#C6A878] border-[#17243B]'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                + {asset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gallery Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {images.map((imgUrl, idx) => (
            <div
              key={`${imgUrl}-${idx}`}
              className="rounded-xl overflow-hidden border border-slate-200 bg-white flex flex-col shadow-xs"
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                <img
                  src={imgUrl}
                  alt={`Gallery photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {idx === 0 && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#17243B]/85 text-[#C6A878] text-[10px] font-bold backdrop-blur-sm whitespace-nowrap">
                    {coverBadgeLabel}
                  </span>
                )}
              </div>

              <div className="p-2 flex items-center justify-between gap-1 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, idx - 1)}
                    title="Move earlier"
                    aria-label={`Move image ${idx + 1} earlier`}
                    className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 flex items-center justify-center"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => handleMove(idx, idx + 1)}
                    title="Move later"
                    aria-label={`Move image ${idx + 1} later`}
                    className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 flex items-center justify-center"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => handlePromoteCover(idx)}
                      title="Set as primary cover"
                      aria-label={`Set image ${idx + 1} as cover`}
                      className="w-7 h-7 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center justify-center"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    title="Remove photo"
                    aria-label={`Remove image ${idx + 1}`}
                    className="w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-500">
          <ImageIcon className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
          <p className="text-xs">{emptyHint}</p>
        </div>
      )}
    </div>
  );
};

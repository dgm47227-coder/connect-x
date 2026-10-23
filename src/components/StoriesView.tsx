import React, { useState } from 'react';
import {
  Plus,
  Clock,
  Eye,
  Trash2,
  Globe,
  Users,
  X,
  Flag,
  Image as ImageIcon,
  Type,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { StoryAudience, StoryItem, UserPublicProfile } from '../types/connectx';
import {
  filterActiveStories,
  formatRemainingStoryTime,
  validateStoryPayload,
} from '../utils/connectxRules';
import { createStoryVisualSvg } from '../utils/seedData';

interface StoriesViewProps {
  currentUser: UserPublicProfile;
  stories: StoryItem[];
  friendUids: Set<string>;
  blockedUids: Set<string>;
  onCreateStory: (story: {
    mediaType: 'text' | 'image';
    caption: string;
    mediaUrl: string;
    backgroundStyle: string;
    audience: StoryAudience;
  }) => void;
  onDeleteStory: (storyId: string) => void;
  onRecordStoryView: (storyId: string) => void;
  onReportTarget: (
    targetUid: string,
    targetLabel: string,
    targetType: 'user' | 'message' | 'story'
  ) => void;
}

const BACKDROP_STYLES = [
  {
    label: 'Indigo Night',
    value: 'from-indigo-950 via-blue-900 to-slate-950',
  },
  {
    label: 'Cobalt Slate',
    value: 'from-slate-900 via-indigo-900 to-slate-950',
  },
  {
    label: 'Violet Dusk',
    value: 'from-purple-950 via-indigo-950 to-slate-900',
  },
];

export const StoriesView: React.FC<StoriesViewProps> = ({
  currentUser,
  stories,
  friendUids,
  blockedUids,
  onCreateStory,
  onDeleteStory,
  onRecordStoryView,
  onReportTarget,
}) => {
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mediaType, setMediaType] = useState<'text' | 'image'>('text');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [backgroundStyle, setBackgroundStyle] = useState(BACKDROP_STYLES[0].value);
  const [audience, setAudience] = useState<StoryAudience>(currentUser.privacyStoryAudience);
  const [formError, setFormError] = useState<string | null>(null);

  const visibleStories = filterActiveStories(
    stories,
    Date.now(),
    currentUser.uid,
    friendUids,
    blockedUids
  );

  const openStoryAtIndex = (index: number) => {
    const story = visibleStories[index];
    if (story) {
      onRecordStoryView(story.storyId);
      setActiveStoryIndex(index);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const check = validateStoryPayload(caption, mediaType, mediaUrl);
    if (!check.valid) {
      setFormError(check.error || 'Invalid story parameters.');
      return;
    }

    onCreateStory({
      mediaType,
      caption: caption.trim(),
      mediaUrl: mediaType === 'image' ? mediaUrl : '',
      backgroundStyle,
      audience,
    });

    setCaption('');
    setMediaUrl('');
    setShowCreateModal(false);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    if (!file.type.startsWith('image/')) {
      setFormError('Story media must be a valid image file.');
      return;
    }
    if (file.size > 35000) {
      setFormError('Image exceeds 35KB inline limit. Choose a studio preset or smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMediaUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const activeStory =
    activeStoryIndex !== null && visibleStories[activeStoryIndex]
      ? visibleStories[activeStoryIndex]
      : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">24-Hour Ephemeral Stories</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Stories automatically expire after 24 hours. Server-side Firestore Security Rules block
            reads once <code className="font-mono">expiresAt &lt;= request.time</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Share Story</span>
        </button>
      </div>

      {/* Horizontal Story Rings */}
      <div className="flex items-center gap-4 overflow-x-auto py-2 px-1">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-indigo-500 flex items-center justify-center bg-indigo-50/50 dark:bg-indigo-950/30 group-hover:bg-indigo-100/60 transition-colors">
            <Plus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            New Story
          </span>
        </button>

        {visibleStories.map((story, idx) => (
          <button
            key={story.storyId}
            type="button"
            onClick={() => openStoryAtIndex(idx)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
          >
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500">
              <img
                src={story.authorAvatarUrl}
                alt={story.authorDisplayName}
                referrerPolicy="no-referrer"
                className="w-15 h-15 rounded-full object-cover border-2 border-white dark:border-slate-900"
              />
            </div>
            <span className="text-xs font-medium max-w-[76px] truncate">
              {story.authorUid === currentUser.uid ? 'Your Story' : story.authorDisplayName}
            </span>
          </button>
        ))}
      </div>

      {/* Story Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleStories.map((story, idx) => {
          const isOwner = story.authorUid === currentUser.uid;
          return (
            <div
              key={story.storyId}
              className={`relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-80 flex flex-col justify-between p-4 bg-gradient-to-br ${story.backgroundStyle} text-white`}
            >
              {story.mediaType === 'image' && story.mediaUrl && (
                <img
                  src={story.mediaUrl}
                  alt={story.caption}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-55"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/40" />

              {/* Top Author & Expiration Header */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={story.authorAvatarUrl}
                    alt={story.authorDisplayName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover border border-white/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{story.authorDisplayName}</div>
                    <div className="text-[10px] text-slate-300 font-mono truncate">
                      @{story.authorUsername}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-200 tabular-nums shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{formatRemainingStoryTime(story.expiresAt)}</span>
                </div>
              </div>

              {/* Center/Bottom Caption & Controls */}
              <div className="relative z-10 space-y-3">
                <p className="text-sm font-medium leading-snug line-clamp-3">{story.caption}</p>

                <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      {story.audience === 'public' ? (
                        <Globe className="w-3.5 h-3.5" />
                      ) : (
                        <Users className="w-3.5 h-3.5" />
                      )}
                      <span>{story.audience === 'public' ? 'Public' : 'Friends'}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{story.viewersCount}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openStoryAtIndex(idx)}
                      className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      View
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        aria-label="Delete my story"
                        onClick={() => onDeleteStory(story.storyId)}
                        className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Story Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-story-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="create-story-title" className="text-base font-bold">
                Create 24-Hour Story
              </h2>
              <button
                type="button"
                aria-label="Close create story modal"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Story Format Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setMediaType('text')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    mediaType === 'text'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Text Story</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMediaType('image');
                    if (!mediaUrl) {
                      setMediaUrl(createStoryVisualSvg('aurora', 'Twilight Pavilion'));
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    mediaType === 'image'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Photo Story</span>
                </button>
              </div>

              <div>
                <label
                  htmlFor="story-caption"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Story Caption / Text (1–500 chars)
                </label>
                <textarea
                  id="story-caption"
                  rows={3}
                  required
                  maxLength={500}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share what you are working on..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {mediaType === 'image' ? (
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Select Studio Visual or Upload Image (Max 35KB)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMediaUrl(createStoryVisualSvg('aurora', 'Twilight Pavilion'))
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:border-indigo-500 cursor-pointer"
                    >
                      Twilight Pavilion
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMediaUrl(createStoryVisualSvg('studio', 'Minimalist Studio'))
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:border-indigo-500 cursor-pointer"
                    >
                      Minimalist Studio
                    </button>
                    <label className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium cursor-pointer hover:bg-slate-200">
                      <span>Upload Custom File</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Canvas Style
                  </span>
                  <div className="flex gap-2">
                    {BACKDROP_STYLES.map((b) => (
                      <button
                        key={b.label}
                        type="button"
                        onClick={() => setBackgroundStyle(b.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                          backgroundStyle === b.value
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="story-audience"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Audience Control
                </label>
                <select
                  id="story-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as StoryAudience)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80"
                >
                  <option value="friends">Friends Only (Accepted Friends)</option>
                  <option value="public">Public (All Authenticated Users)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Publish Story (Expires in 24h)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Story Viewer Modal */}
      {activeStory && activeStoryIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Story viewer"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-3xl overflow-hidden border border-white/15 bg-slate-950 text-white flex flex-col">
            {/* Progress Bar */}
            <div className="flex gap-1 p-3 bg-black/40">
              {visibleStories.map((s, idx) => (
                <div
                  key={s.storyId}
                  className={`h-1 flex-1 rounded-full ${
                    idx <= activeStoryIndex ? 'bg-indigo-400' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Viewer Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <img
                  src={activeStory.authorAvatarUrl}
                  alt={activeStory.authorDisplayName}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="text-sm font-bold">{activeStory.authorDisplayName}</div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 tabular-nums">
                    <span>@{activeStory.authorUsername}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRemainingStoryTime(activeStory.expiresAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {activeStory.authorUid === currentUser.uid ? (
                  <button
                    type="button"
                    aria-label="Delete this story"
                    onClick={() => {
                      onDeleteStory(activeStory.storyId);
                      setActiveStoryIndex(null);
                    }}
                    className="p-2 rounded-lg text-red-400 hover:bg-white/10 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Report story"
                    onClick={() => {
                      const s = activeStory;
                      setActiveStoryIndex(null);
                      onReportTarget(s.authorUid, `Story by @${s.authorUsername}`, 'story');
                    }}
                    className="p-2 rounded-lg text-slate-300 hover:text-amber-400 hover:bg-white/10 cursor-pointer"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close story viewer"
                  onClick={() => setActiveStoryIndex(null)}
                  className="p-2 rounded-lg text-slate-300 hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Story Body */}
            <div
              className={`relative h-96 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br ${activeStory.backgroundStyle}`}
            >
              {activeStory.mediaType === 'image' && activeStory.mediaUrl && (
                <img
                  src={activeStory.mediaUrl}
                  alt={activeStory.caption}
                  className="absolute inset-0 w-full h-full object-cover opacity-65"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <p className="relative z-10 text-lg font-semibold leading-relaxed max-w-sm">
                {activeStory.caption}
              </p>
            </div>

            {/* Footer Controls & Viewers List (Subject to Owner Privacy) */}
            <div className="p-4 bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={activeStoryIndex === 0}
                  onClick={() => setActiveStoryIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  className="px-3 py-1.5 rounded-lg bg-white/10 disabled:opacity-30 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <span className="text-xs text-slate-400 tabular-nums">
                  {activeStory.viewersCount} views ·{' '}
                  {activeStory.audience === 'public' ? 'Public' : 'Friends Only'}
                </span>
                <button
                  type="button"
                  disabled={activeStoryIndex >= visibleStories.length - 1}
                  onClick={() =>
                    setActiveStoryIndex((i) =>
                      i !== null && i < visibleStories.length - 1 ? i + 1 : i
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-white/10 disabled:opacity-30 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {activeStory.authorUid === currentUser.uid && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                    Story Viewers (Visible only to you):
                  </div>
                  {activeStory.viewers && activeStory.viewers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeStory.viewers.map((v) => (
                        <span
                          key={v.viewerUid}
                          className="text-xs text-slate-200 font-mono"
                        >
                          @{v.viewerUsername}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No viewers recorded yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

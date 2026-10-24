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
  Sparkles,
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
    label: 'Daylight Emerald',
    value: 'from-[#d9fdd3] via-emerald-100 to-teal-100',
  },
  {
    label: 'Warm Cream',
    value: 'from-[#efeae2] via-amber-100 to-emerald-100',
  },
  {
    label: 'Sky Mist',
    value: 'from-sky-100 via-teal-100 to-[#f0f2f5]',
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
    <div className="space-y-6 text-black">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-[#d1d7db] bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black">
            24-Hour Ephemeral Stories
          </h1>
          <p className="text-xs text-black mt-1">
            Synced live via Cloud Firestore (<code className="font-mono font-semibold text-black">/stories</code>).
            Stories automatically expire after 24 hours.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-[#25d366] hover:bg-[#1da851] text-black text-xs font-bold transition-colors flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer border border-[#1da851]"
        >
          <Plus className="w-4 h-4 text-black" />
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
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#00a884] flex items-center justify-center bg-white group-hover:bg-[#d9fdd3] transition-colors">
            <Plus className="w-6 h-6 text-black" />
          </div>
          <span className="text-xs font-semibold text-black">New Story</span>
        </button>

        {visibleStories.map((story, idx) => (
          <button
            key={story.storyId}
            type="button"
            onClick={() => openStoryAtIndex(idx)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
          >
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#25d366] to-[#00a884]">
              <img
                src={story.authorAvatarUrl}
                alt={story.authorDisplayName}
                referrerPolicy="no-referrer"
                className="w-15 h-15 rounded-full object-cover border-2 border-white"
              />
            </div>
            <span className="text-xs font-semibold text-black max-w-[76px] truncate">
              {story.authorUid === currentUser.uid ? 'Your Story' : story.authorDisplayName}
            </span>
          </button>
        ))}
      </div>

      {/* Story Cards Grid */}
      {visibleStories.length === 0 ? (
        <div className="p-8 rounded-2xl border border-[#d1d7db] bg-white shadow-xs text-center space-y-2">
          <Sparkles className="w-8 h-8 text-black mx-auto" />
          <p className="text-sm font-bold text-black">No active stories right now</p>
          <p className="text-xs text-black max-w-md mx-auto">
            Share a photo or text update above! Your story will be saved to Cloud Firestore for 24
            hours for your friends or public discovery.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleStories.map((story, idx) => {
            const isOwner = story.authorUid === currentUser.uid;
            return (
              <div
                key={story.storyId}
                className="relative rounded-2xl overflow-hidden border border-[#d1d7db] h-80 flex flex-col justify-between p-4 bg-gradient-to-br from-[#d9fdd3] via-[#efeae2] to-white text-black shadow-xs"
              >
                {story.mediaType === 'image' && story.mediaUrl && (
                  <img
                    src={story.mediaUrl}
                    alt={story.caption}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover opacity-35"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/75 to-white/85" />

                {/* Top Author & Expiration Header */}
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={story.authorAvatarUrl}
                      alt={story.authorDisplayName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-[#d1d7db] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-black truncate">
                        {story.authorDisplayName}
                      </div>
                      <div className="text-[10px] text-black font-mono font-semibold truncate">
                        @{story.authorUsername}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-semibold text-black tabular-nums shrink-0">
                    <Clock className="w-3 h-3 text-black" />
                    <span>{formatRemainingStoryTime(story.expiresAt)}</span>
                  </div>
                </div>

                {/* Center/Bottom Caption & Controls */}
                <div className="relative z-10 space-y-3">
                  <p className="text-sm font-semibold text-black leading-snug line-clamp-3">
                    {story.caption}
                  </p>

                  <div className="pt-2 border-t border-[#d1d7db] flex items-center justify-between text-xs font-medium text-black">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        {story.audience === 'public' ? (
                          <Globe className="w-3.5 h-3.5 text-black" />
                        ) : (
                          <Users className="w-3.5 h-3.5 text-black" />
                        )}
                        <span>{story.audience === 'public' ? 'Public' : 'Friends'}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Eye className="w-3.5 h-3.5 text-black" />
                        <span>{story.viewersCount}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openStoryAtIndex(idx)}
                        className="px-2.5 py-1 rounded-lg bg-[#25d366] hover:bg-[#1da851] text-black text-xs font-bold transition-colors cursor-pointer border border-[#1da851]"
                      >
                        View
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          aria-label="Delete my story"
                          onClick={() => onDeleteStory(story.storyId)}
                          className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-black transition-colors cursor-pointer border border-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-black" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Story Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-story-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-lg w-full rounded-2xl border border-[#d1d7db] bg-white text-black p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="create-story-title" className="text-base font-bold text-black">
                Create 24-Hour Story
              </h2>
              <button
                type="button"
                aria-label="Close create story modal"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-black hover:bg-[#f0f2f5] cursor-pointer"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-100 border border-red-400 text-xs font-medium text-black">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Story Format Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#f0f2f5] border border-[#d1d7db]">
                <button
                  type="button"
                  onClick={() => setMediaType('text')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    mediaType === 'text' ? 'bg-[#d9fdd3] text-black border border-[#00a884]' : 'text-black'
                  }`}
                >
                  <Type className="w-3.5 h-3.5 text-black" />
                  <span>Text Story</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMediaType('image');
                    if (!mediaUrl) {
                      setMediaUrl(createStoryVisualSvg('aurora', 'Emerald Aurora'));
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    mediaType === 'image' ? 'bg-[#d9fdd3] text-black border border-[#00a884]' : 'text-black'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-black" />
                  <span>Photo Story</span>
                </button>
              </div>

              <div>
                <label
                  htmlFor="story-caption"
                  className="block text-xs font-bold text-black mb-1.5"
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
                  placeholder="Share an update with your friends..."
                  className="w-full px-3.5 py-2.5 text-sm text-black placeholder:text-black/60 rounded-xl border border-[#d1d7db] bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                />
              </div>

              {mediaType === 'image' ? (
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-black">
                    Select Studio Visual or Upload Image (Max 35KB)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMediaUrl(createStoryVisualSvg('aurora', 'Emerald Aurora'))
                      }
                      className="px-3 py-1.5 rounded-lg border border-[#d1d7db] bg-[#f0f2f5] text-black text-xs font-semibold hover:bg-[#d9fdd3] cursor-pointer"
                    >
                      Emerald Aurora
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMediaUrl(createStoryVisualSvg('studio', 'Minimalist Studio'))
                      }
                      className="px-3 py-1.5 rounded-lg border border-[#d1d7db] bg-[#f0f2f5] text-black text-xs font-semibold hover:bg-[#d9fdd3] cursor-pointer"
                    >
                      Minimalist Studio
                    </button>
                    <label className="px-3 py-1.5 rounded-lg bg-[#d9fdd3] border border-[#00a884] text-black text-xs font-bold cursor-pointer hover:bg-[#c5f6bd]">
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
                  <span className="block text-xs font-bold text-black mb-1.5">
                    Canvas Style
                  </span>
                  <div className="flex gap-2">
                    {BACKDROP_STYLES.map((b) => (
                      <button
                        key={b.label}
                        type="button"
                        onClick={() => setBackgroundStyle(b.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          backgroundStyle === b.value
                            ? 'border-[#00a884] text-black bg-[#d9fdd3]'
                            : 'border-[#d1d7db] bg-[#f0f2f5] text-black'
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
                  className="block text-xs font-bold text-black mb-1.5"
                >
                  Audience Control
                </label>
                <select
                  id="story-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as StoryAudience)}
                  className="w-full px-3.5 py-2.5 text-sm text-black rounded-xl border border-[#d1d7db] bg-[#f0f2f5]"
                >
                  <option value="friends">Friends Only (Accepted Friends)</option>
                  <option value="public">Public (All Authenticated Users)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#d1d7db] bg-[#f0f2f5] text-black text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#25d366] hover:bg-[#1da851] text-black text-xs font-bold cursor-pointer border border-[#1da851]"
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
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-3xl overflow-hidden border border-[#d1d7db] bg-white text-black flex flex-col shadow-2xl">
            {/* Progress Bar */}
            <div className="flex gap-1 p-3 bg-[#f0f2f5]">
              {visibleStories.map((s, idx) => (
                <div
                  key={s.storyId}
                  className={`h-1 flex-1 rounded-full ${
                    idx <= activeStoryIndex ? 'bg-[#00a884]' : 'bg-[#d1d7db]'
                  }`}
                />
              ))}
            </div>

            {/* Viewer Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-[#d1d7db] bg-white">
              <div className="flex items-center gap-2.5">
                <img
                  src={activeStory.authorAvatarUrl}
                  alt={activeStory.authorDisplayName}
                  className="w-9 h-9 rounded-full object-cover border border-[#d1d7db]"
                />
                <div>
                  <div className="text-sm font-bold text-black">
                    {activeStory.authorDisplayName}
                  </div>
                  <div className="text-[11px] text-black flex items-center gap-1.5 tabular-nums">
                    <span className="text-black font-mono font-semibold">@{activeStory.authorUsername}</span>
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
                    className="p-2 rounded-lg text-black hover:bg-red-100 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-black" />
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
                    className="p-2 rounded-lg text-black hover:bg-[#f0f2f5] cursor-pointer"
                  >
                    <Flag className="w-4 h-4 text-black" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close story viewer"
                  onClick={() => setActiveStoryIndex(null)}
                  className="p-2 rounded-lg text-black hover:bg-[#f0f2f5] cursor-pointer"
                >
                  <X className="w-4 h-4 text-black" />
                </button>
              </div>
            </div>

            {/* Story Body */}
            <div className="relative h-96 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#d9fdd3] via-[#efeae2] to-white">
              {activeStory.mediaType === 'image' && activeStory.mediaUrl && (
                <img
                  src={activeStory.mediaUrl}
                  alt={activeStory.caption}
                  className="absolute inset-0 w-full h-full object-cover opacity-35"
                />
              )}
              <div className="absolute inset-0 bg-white/75" />
              <p className="relative z-10 text-lg font-bold text-black leading-relaxed max-w-sm">
                {activeStory.caption}
              </p>
            </div>

            {/* Footer Controls & Viewers List (Subject to Owner Privacy) */}
            <div className="p-4 bg-white border-t border-[#d1d7db] space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={activeStoryIndex === 0}
                  onClick={() => setActiveStoryIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  className="px-3 py-1.5 rounded-lg bg-[#f0f2f5] border border-[#d1d7db] disabled:opacity-40 text-black text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-black" />
                  <span>Previous</span>
                </button>
                <span className="text-xs font-semibold text-black tabular-nums">
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
                  className="px-3 py-1.5 rounded-lg bg-[#f0f2f5] border border-[#d1d7db] disabled:opacity-40 text-black text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 text-black" />
                </button>
              </div>

              {activeStory.authorUid === currentUser.uid && (
                <div className="pt-2 border-t border-[#d1d7db]">
                  <div className="text-[11px] font-bold text-black mb-1.5">
                    Story Viewers (Visible only to you):
                  </div>
                  {activeStory.viewers && activeStory.viewers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeStory.viewers.map((v) => (
                        <span key={v.viewerUid} className="text-xs text-black font-mono font-semibold">
                          @{v.viewerUsername}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-black">No viewers recorded yet.</p>
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

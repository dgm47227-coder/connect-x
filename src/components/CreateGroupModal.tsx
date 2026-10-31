import React, { useState } from 'react';
import { Users, X, Check, Search, ShieldCheck } from 'lucide-react';
import { UserPublicProfile } from '../types/connectx';

interface CreateGroupModalProps {
  isOpen: boolean;
  friends: UserPublicProfile[];
  currentUserId: string;
  onCreateGroup: (name: string, description: string, memberUids: string[]) => Promise<void>;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  friends,
  currentUserId,
  onCreateGroup,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleMember = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const filteredFriends = friends.filter((f) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      f.displayName.toLowerCase().includes(q) ||
      f.username.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a group name.');
      return;
    }
    if (selectedUids.size === 0) {
      setError('Please select at least one member to start a group.');
      return;
    }

    setLoading(true);
    try {
      await onCreateGroup(trimmedName, description.trim(), Array.from(selectedUids));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#008C5A]/15 text-[#006B46]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 id="create-group-title" className="text-base font-bold text-slate-900">
                New Group Chat
              </h3>
              <p className="text-[11px] text-slate-500">
                Select friends to collaborate and chat in a shared space
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="group-name" className="block text-xs font-bold text-slate-800 mb-1">
              Group Name *
            </label>
            <input
              id="group-name"
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project ConnectX Team"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#008C5A]"
            />
          </div>

          <div>
            <label htmlFor="group-desc" className="block text-xs font-bold text-slate-800 mb-1">
              Description (Optional)
            </label>
            <input
              id="group-desc"
              type="text"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-[#f0f2f5] focus:outline-none focus:ring-2 focus:ring-[#008C5A]"
            />
          </div>

          {/* Members Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">
                Add Members ({selectedUids.size} selected)
              </label>
            </div>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friends..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#008C5A]"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filteredFriends.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  {friends.length === 0 ? 'No accepted friends yet. Add friends first!' : 'No matching friends.'}
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedUids.has(friend.uid);
                  return (
                    <div
                      key={friend.uid}
                      onClick={() => toggleMember(friend.uid)}
                      className={`p-2.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                        isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={friend.avatarUrl}
                          alt={friend.displayName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover bg-slate-200 shrink-0"
                        />
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {friend.displayName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            @{friend.username}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-[#008C5A] border-[#008C5A] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-4 pt-2 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedUids.size === 0}
              className="px-5 py-2 rounded-xl bg-[#008C5A] hover:bg-[#006B46] disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{loading ? 'Creating...' : 'Create Group'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

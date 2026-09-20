import { useCallback, useEffect, useState } from 'react';
import type { EnginePatch } from '../audio';
import { BUILTIN_PATCHES } from '../audio';

const KEY = 'drivesynth.patches.v1';

function loadUser(): EnginePatch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EnginePatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function usePatches() {
  const [userPatches, setUserPatches] = useState<EnginePatch[]>(() => loadUser());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(userPatches));
    } catch {
      /* ignore */
    }
  }, [userPatches]);

  const savePatch = useCallback((patch: EnginePatch) => {
    setUserPatches((list) => {
      const idx = list.findIndex((p) => p.id === patch.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = patch;
        return next;
      }
      return [...list, patch];
    });
  }, []);

  const deletePatch = useCallback((id: string) => {
    setUserPatches((list) => list.filter((p) => p.id !== id));
  }, []);

  const allPatches = [...BUILTIN_PATCHES, ...userPatches];

  return { userPatches, allPatches, builtins: BUILTIN_PATCHES, savePatch, deletePatch };
}

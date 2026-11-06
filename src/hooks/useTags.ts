import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { getLocal, setLocal, CACHE_KEYS } from "../lib/cache";
import type { TagIndex, TagDefinition } from "../types";
import { PRESET_TAGS, RETIRED_PRESET_TAGS, ukTag } from "../lib/tags";

const DEFAULT_INDEX: TagIndex = {
  tags: PRESET_TAGS,
  updatedAt: new Date().toISOString(),
};

export function useTags() {
  // Instant from cache
  const [tagIndex, setTagIndex] = useState<TagIndex>(
    () => getLocal<TagIndex>(CACHE_KEYS.TAG_INDEX) ?? DEFAULT_INDEX
  );
  const [isLoading, setIsLoading] = useState(false);

  // Background sync
  useEffect(() => {
    api
      .get<TagIndex>("/tags")
      .then((fetched) => {
        let data = fetched;
        if (data) {
          // UK names for US tags ("fall" -> "autumn"); retired US-only presets are dropped
          // unless they were custom. Saved back once if anything changed.
          const seen = new Set<string>();
          const migratedTags: TagDefinition[] = [];
          for (const t of data.tags) {
            if (t.type === "preset" && RETIRED_PRESET_TAGS.has(t.name)) continue;
            const name = ukTag(t.name);
            if (seen.has(name)) continue;
            seen.add(name);
            migratedTags.push(name === t.name ? t : { ...t, name });
          }
          const migrated = migratedTags.length !== data.tags.length || migratedTags.some((t, i) => t !== data.tags[i]);
          if (migrated) {
            data = { ...data, tags: migratedTags };
            api.put("/tags", { ...data, updatedAt: new Date().toISOString() }).catch(() => {});
          }
          const existingNames = new Set(data.tags.map((t) => t.name));
          const missingPresets = PRESET_TAGS.filter(
            (p) => !existingNames.has(p.name)
          );
          const merged = {
            ...data,
            tags: [...data.tags, ...missingPresets],
          };
          setTagIndex(merged);
          setLocal(CACHE_KEYS.TAG_INDEX, merged);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Optimistic save
  const saveTags = useCallback(async (updated: TagIndex) => {
    const withTimestamp = { ...updated, updatedAt: new Date().toISOString() };
    setTagIndex(withTimestamp);
    setLocal(CACHE_KEYS.TAG_INDEX, withTimestamp);
    api.put("/tags", withTimestamp).catch(() => {});
  }, []);

  const addCustomTag = useCallback(
    async (name: string) => {
      const tag: TagDefinition = {
        name: name.toLowerCase().trim(),
        type: "custom",
        group: "custom",
        usageCount: 0,
      };
      await saveTags({ ...tagIndex, tags: [...tagIndex.tags, tag] });
      return tag;
    },
    [tagIndex, saveTags]
  );

  const deleteCustomTag = useCallback(
    async (name: string) => {
      await saveTags({
        ...tagIndex,
        tags: tagIndex.tags.filter(
          (t) => !(t.name === name && t.type === "custom")
        ),
      });
    },
    [tagIndex, saveTags]
  );

  const renameTag = useCallback(
    async (oldName: string, newName: string) => {
      await saveTags({
        ...tagIndex,
        tags: tagIndex.tags.map((t) =>
          t.name === oldName ? { ...t, name: newName.toLowerCase().trim() } : t
        ),
      });
    },
    [tagIndex, saveTags]
  );

  const allTagNames = tagIndex.tags.map((t) => t.name);
  const presetTags = tagIndex.tags.filter((t) => t.type === "preset");
  const customTags = tagIndex.tags.filter((t) => t.type === "custom");

  return {
    tagIndex,
    allTagNames,
    presetTags,
    customTags,
    isLoading,
    fetchTags: () => {},
    addCustomTag,
    deleteCustomTag,
    renameTag,
  };
}

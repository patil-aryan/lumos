'use client';

import useSWR from 'swr';
import { UIArtifact } from '@/components/artifact';
import { useCallback, useMemo } from 'react';

export const initialArtifactData: UIArtifact = {
  documentId: 'init',
  content: '',
  kind: 'text',
  title: '',
  status: 'idle',
  isVisible: false,
  boundingBox: {
    top: 0,
    left: 0,
    width: typeof window !== 'undefined' ? window.innerWidth * 0.5 : 500,
    height: 0,
  },
};

// The artifact store contains both the artifact data and methods to manipulate it
export interface ArtifactStore {
  artifact: UIArtifact;
  setArtifact: (updater: UIArtifact | ((current: UIArtifact) => UIArtifact)) => void;
  setOpen: (isVisible: boolean) => void;
  metadata: any;
  setMetadata: (data: any) => void;
  isVisible: boolean;
}

// Main hook to manage artifact state
export function useArtifact(): ArtifactStore {
  const { data: localArtifact, mutate: setLocalArtifact } = useSWR<UIArtifact>(
    'artifact',
    null,
    {
      fallbackData: initialArtifactData,
    }
  );

  const artifact = useMemo(() => {
    return localArtifact || initialArtifactData;
  }, [localArtifact]);

  const setArtifact = useCallback(
    (updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
      setLocalArtifact((currentArtifact) => {
        const artifactToUpdate = currentArtifact || initialArtifactData;

        if (typeof updaterFn === 'function') {
          return updaterFn(artifactToUpdate);
        }

        return updaterFn;
      });
    },
    [setLocalArtifact]
  );

  const setOpen = useCallback((isVisible: boolean) => {
    setLocalArtifact((currentArtifact) => {
      const artifactToUpdate = currentArtifact || initialArtifactData;
      return {
        ...artifactToUpdate,
        isVisible,
      };
    });
  }, [setLocalArtifact]);

  const { data: localArtifactMetadata, mutate: setLocalArtifactMetadata } =
    useSWR<any>(
      () =>
        artifact.documentId ? `artifact-metadata-${artifact.documentId}` : null,
      null,
      {
        fallbackData: null,
      }
    );

  return {
    artifact,
    setArtifact,
    setOpen,
    metadata: localArtifactMetadata,
    setMetadata: setLocalArtifactMetadata,
    isVisible: artifact.isVisible,
  };
}

// Type definitions for selectors
export type ArtifactSelector<T> = (state: ArtifactStore) => T;
export type FullStoreSelector = (state: ArtifactStore) => ArtifactStore;

// Improved selector hook with better type safety
export function useArtifactSelector<T>(selector: ArtifactSelector<T>): T;
export function useArtifactSelector(): ArtifactStore; // No selector case

export function useArtifactSelector<T>(selector?: ArtifactSelector<T>): T | ArtifactStore {
  const store = useArtifact();
  
  // Return the entire store if no selector is provided
  if (!selector) {
    return store;
  }
  
  // Otherwise apply the selector to the store
  return selector(store);
}


import { useState, useCallback, useEffect } from 'react';

// --- CONFIGURABLE LIMITS ---
// Set low to meet the user's budget goal of ~$1/month.
// 5 major text generations and 20 image generations per day should keep costs minimal.
export const MAX_DAILY_GENERATIONS = 5;
export const MAX_DAILY_IMAGES = 20;

const STORAGE_KEY = 'sayuna_usage_state_v2';
const LEGACY_DATE_KEY = 'sayuna_usage_date';
const LEGACY_GENERATION_KEY = 'sayuna_generation_count';
const LEGACY_IMAGE_KEY = 'sayuna_image_count';

type UsageType = 'generations' | 'images';
type UsageCounts = {
    generations: number;
    images: number;
};
type UsageState = UsageCounts & {
    date: string;
};

const getTodaysDateString = () => new Date().toDateString();

const getLimitForType = (type: UsageType): number => (
    type === 'generations' ? MAX_DAILY_GENERATIONS : MAX_DAILY_IMAGES
);

const sanitizeCount = (value: unknown, max: number): number => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }
    return Math.min(parsed, max);
};

const emptyCounts = (): UsageCounts => ({ generations: 0, images: 0 });

const normalizeState = (raw: Partial<UsageState>, today: string): UsageState => {
    if (raw.date !== today) {
        return { date: today, ...emptyCounts() };
    }

    return {
        date: today,
        generations: sanitizeCount(raw.generations, MAX_DAILY_GENERATIONS),
        images: sanitizeCount(raw.images, MAX_DAILY_IMAGES),
    };
};

const readLegacyState = (today: string): UsageState => {
    try {
        const legacyDate = localStorage.getItem(LEGACY_DATE_KEY);
        if (legacyDate !== today) {
            return { date: today, ...emptyCounts() };
        }

        return {
            date: today,
            generations: sanitizeCount(localStorage.getItem(LEGACY_GENERATION_KEY), MAX_DAILY_GENERATIONS),
            images: sanitizeCount(localStorage.getItem(LEGACY_IMAGE_KEY), MAX_DAILY_IMAGES),
        };
    } catch (error) {
        console.warn('Failed to read legacy usage keys, resetting to defaults.', error);
        return { date: today, ...emptyCounts() };
    }
};

const readStateFromStorage = (): UsageState => {
    const today = getTodaysDateString();
    try {
        const rawState = localStorage.getItem(STORAGE_KEY);
        if (rawState) {
            const parsed = JSON.parse(rawState) as Partial<UsageState>;
            return normalizeState(parsed, today);
        }
    } catch (error) {
        console.warn('Failed to parse usage state, resetting to defaults.', error);
    }

    return readLegacyState(today);
};

const persistStateToStorage = (state: UsageState): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        // Keep legacy keys in sync for backward compatibility.
        localStorage.setItem(LEGACY_DATE_KEY, state.date);
        localStorage.setItem(LEGACY_GENERATION_KEY, String(state.generations));
        localStorage.setItem(LEGACY_IMAGE_KEY, String(state.images));
    } catch (error) {
        console.warn('Failed to persist usage state.', error);
    }
};

/**
 * A hook to manage and track daily API usage limits stored in localStorage.
 * This helps prevent API abuse and control costs.
 */
export const useUsageTracker = () => {
    const [counts, setCounts] = useState<UsageCounts>(() => {
        const initial = readStateFromStorage();
        return { generations: initial.generations, images: initial.images };
    });

    const updateCounts = useCallback(() => {
        const currentState = readStateFromStorage();
        persistStateToStorage(currentState);
        setCounts({ generations: currentState.generations, images: currentState.images });
    }, []);

    const mutateCounts = useCallback((mutator: (state: UsageState) => UsageState) => {
        const currentState = readStateFromStorage();
        const nextState = normalizeState(mutator(currentState), getTodaysDateString());
        persistStateToStorage(nextState);
        setCounts({ generations: nextState.generations, images: nextState.images });
        return nextState;
    }, []);

    // Effect to initialize counts on component mount and sync changes from other tabs.
    useEffect(() => {
        updateCounts();

        const handleStorage = (event: StorageEvent) => {
            if (!event.key || [STORAGE_KEY, LEGACY_DATE_KEY, LEGACY_GENERATION_KEY, LEGACY_IMAGE_KEY].includes(event.key)) {
                updateCounts();
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [updateCounts]);

    const incrementCount = useCallback((type: UsageType) => {
        mutateCounts((state) => ({
            ...state,
            [type]: state[type] + 1,
        }));
    }, [mutateCounts]);

    const tryIncrementCount = useCallback((type: UsageType) => {
        const limit = getLimitForType(type);
        let incremented = false;

        mutateCounts((state) => {
            if (state[type] >= limit) {
                return state;
            }

            incremented = true;
            return {
                ...state,
                [type]: state[type] + 1,
            };
        });

        return incremented;
    }, [mutateCounts]);

    const decrementCount = useCallback((type: UsageType) => {
        mutateCounts((state) => ({
            ...state,
            [type]: Math.max(0, state[type] - 1),
        }));
    }, [mutateCounts]);

    return {
        ...counts,
        limits: {
            generations: MAX_DAILY_GENERATIONS,
            images: MAX_DAILY_IMAGES,
        },
        incrementCount,
        tryIncrementCount,
        decrementCount,
        updateCounts,
        canGenerate: counts.generations < MAX_DAILY_GENERATIONS,
        canGenerateImage: counts.images < MAX_DAILY_IMAGES,
    };
};

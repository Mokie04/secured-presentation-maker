
import { useState, useCallback, useEffect } from 'react';

// --- CONFIGURABLE LIMITS ---
// Set low to meet the user's budget goal of ~$1/month.
// 5 major text generations and 20 image generations per day should keep costs minimal.
export const MAX_DAILY_GENERATIONS = 5;
export const MAX_DAILY_IMAGES = 20;

const getTodaysDateString = () => new Date().toDateString();

/**
 * A hook to manage and track daily API usage limits stored in localStorage.
 * This helps prevent API abuse and control costs.
 */
export const useUsageTracker = () => {
    const [counts, setCounts] = useState({
        generations: 0,
        images: 0,
    });

    /**
     * Reads from localStorage and updates the state.
     * Resets counts if the date has changed.
     */
    const updateCounts = useCallback(() => {
        const today = getTodaysDateString();
        const storedDate = localStorage.getItem('sayuna_usage_date');

        let generationCount = 0;
        let imageCount = 0;

        if (storedDate === today) {
            // If it's the same day, read the stored counts.
            generationCount = parseInt(localStorage.getItem('sayuna_generation_count') || '0', 10);
            imageCount = parseInt(localStorage.getItem('sayuna_image_count') || '0', 10);
        } else {
            // If it's a new day, reset everything.
            localStorage.setItem('sayuna_usage_date', today);
            localStorage.setItem('sayuna_generation_count', '0');
            localStorage.setItem('sayuna_image_count', '0');
        }

        setCounts({ generations: generationCount, images: imageCount });
    }, []);

    // Effect to initialize counts on component mount.
    useEffect(() => {
        updateCounts();
    }, [updateCounts]);

    /**
     * Increments a specific usage type ('generations' or 'images').
     * Handles date changes gracefully and uses a functional state update to prevent race conditions.
     */
    const incrementCount = useCallback((type: 'generations' | 'images') => {
        setCounts(prevCounts => {
            const today = getTodaysDateString();
            const storedDate = localStorage.getItem('sayuna_usage_date');

            if (storedDate !== today) {
                // New day: reset counts and then apply the first increment.
                const newCounts = { generations: 0, images: 0 };
                newCounts[type] = 1;
                
                localStorage.setItem('sayuna_usage_date', today);
                localStorage.setItem('sayuna_generation_count', String(newCounts.generations));
                localStorage.setItem('sayuna_image_count', String(newCounts.images));
                
                return newCounts;
            } else {
                // Same day: just increment the specific count.
                const newCounts = {
                    ...prevCounts,
                    [type]: (prevCounts[type] || 0) + 1,
                };

                localStorage.setItem(`sayuna_${type}_count`, String(newCounts[type]));
                
                return newCounts;
            }
        });
    }, []);

    return {
        ...counts,
        limits: {
            generations: MAX_DAILY_GENERATIONS,
            images: MAX_DAILY_IMAGES,
        },
        incrementCount,
        updateCounts,
        canGenerate: counts.generations < MAX_DAILY_GENERATIONS,
        canGenerateImage: counts.images < MAX_DAILY_IMAGES,
    };
};

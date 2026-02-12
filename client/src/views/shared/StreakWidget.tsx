import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

/**
 * Renders a small streak widget showing current fire/streak count.
 */
const StreakWidget = () => {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadStreak = async () => {
      setIsLoading(true);
      try {
        const response = await authFetch(apiUrl("/api/streak"));
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as StreakData;
        if (isActive) {
          setStreak(data);
        }
      } catch (caught) {
        console.warn("Failed to load streak.", caught);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadStreak();

    return () => {
      isActive = false;
    };
  }, []);

  if (isLoading || !streak) {
    return null;
  }

  return (
    <div className="streak-widget" title={`Longest: ${streak.longestStreak}`}>
      <span className="streak-widget__icon">🔥</span>
      <span className="streak-widget__count">{streak.currentStreak}</span>
    </div>
  );
};

export default StreakWidget;

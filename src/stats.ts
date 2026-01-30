import fs from 'fs';
import path from 'path';
const file = path.join(__dirname, "..", 'wordle_stats.json');

interface STATS_FILE {
  userStats: { [userId: string]: USER_STATS }
}

interface USER_STATS {
  wins: number
}

class StatsManager {
  private userStats: Map<string, USER_STATS>;

  constructor(statsfile: STATS_FILE) {
    this.userStats = new Map(Object.entries(statsfile.userStats || {}));
  }
  static export_stats_file(statsManager: StatsManager): STATS_FILE {
    const userStatsObj: { [userId: string]: USER_STATS } = {};
    for (const [userId, stats] of statsManager.userStats.entries()) {
      userStatsObj[userId] = stats;
    }
    return { userStats: userStatsObj };
  }
  addWinToUsers(userIds: string[]) {
    for (const userId of userIds) {
      const stats = this.userStats.get(userId) || { wins: 0 };
      stats.wins += 1;
      this.userStats.set(userId, stats);
    }
  }
  getUserStats(userId: string): USER_STATS {
    const stats = this.userStats.get(userId)
    if (stats === undefined)
      return { wins: 0 }
    return stats
  }
}



function loadStats(): STATS_FILE {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
  return { userStats: {} };
}

export function getStatsManager(): StatsManager {
  const statsData = loadStats();
  return new StatsManager(statsData);
}

function saveStats(stats: STATS_FILE) {
  try {
    fs.writeFileSync(file, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Error saving stats:', error);
  }
}

export function persistStats(statsManager: StatsManager) {
  const statsData = StatsManager.export_stats_file(statsManager);
  saveStats(statsData);
}
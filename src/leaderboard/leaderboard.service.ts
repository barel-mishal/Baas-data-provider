import { AnalyticsDto } from '@/common/dto/leaderboard';
import getLeaderBoardDataFROMJSON from '@/common/utils/getLeaderBoardDataFROMJSON';
import { LeaderboardTypeAnalytics } from '@/types/leaderboard';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Leaderboard,
  LeaderboardDocument,
} from '@/common/mongoose/schemas/leaderboard';

@Injectable()
export class LeaderboardService implements OnModuleInit {
  constructor(
    @InjectModel(Leaderboard.name)
    private readonly ContributorModel: Model<LeaderboardDocument>,
  ) {}
  async onModuleInit() {
    await this.deleteAllMembers();
    await this.handleCron();
  }

  @Cron('0 8 * * 0') // Cron expression for 8:00 AM every Sunday
  async handleCron() {
    console.log('Running fetch and store Contributors cron job');
    await this.fetchAndStoreMembers();
  }

  private async fetchAndStoreMembers() {
    const { membersData, timestamp } = await this.fethLeaderBoardDataFROMJSON();

    await Promise.all(
      membersData.map((memberData) => {
        return this.saveFetchedFromGithubContributorToDb(memberData, timestamp);
      }),
    );
  }

  private async saveFetchedFromGithubContributorToDb(memberData, timestamp) {
    try {
      //createOrUpdate member
      //to do - check timestamp in schema
      await this.ContributorModel.findOneAndUpdate(
        {
          node_id: memberData.node_id,
        },
        {
          name: memberData.name,
          node_id: memberData.node_id,
          projects_names: memberData.projects_names,
          avatar_url: memberData.avatar_url,
          score: memberData.score,
          stats: memberData.stats,
          timestamp,
        },
        { upsert: true },
      );
    } catch (error) {
      console.error('Error saving member to db', error);
    }
  }

  private async fethLeaderBoardDataFROMJSON() {
    const membersData = getLeaderBoardDataFROMJSON();
    const timestamp = new Date();
    return { membersData, timestamp };
  }

  async getLeaderboardDataFromDB(): Promise<AnalyticsDto> {
    const since = '2024-01-05T00:00:00Z';
    const until = '2024-04-12T00:00:00Z';
    return {
      members: await this.ContributorModel.find({
        timestamp: { $gte: new Date(since), $lte: new Date(until) },
      }),
      since,
      until,
    } as LeaderboardTypeAnalytics;
  }

  async getLeaderboardDataFROMJSON(): Promise<AnalyticsDto> {
    const since = '2024-01-05T00:00:00Z';
    const until = '2024-04-12T00:00:00Z';
    return {
      members: getLeaderBoardDataFROMJSON(),
      since,
      until,
    } as LeaderboardTypeAnalytics;
  }

  private async deleteAllMembers() {
    await this.ContributorModel.deleteMany({});
  }
}

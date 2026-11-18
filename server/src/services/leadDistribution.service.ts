import { prisma } from '../utils/prisma.js';
import { Role } from '@prisma/client';

export class LeadDistributionService {
  /**
   * Assigns a lead to an available agent using fair round-robin distribution.
   * Agents marked on leave (isOnLeave = true) are automatically excluded.
   */
  static async assignNextAvailableAgent(orgId: string): Promise<string | null> {
    // Find all active sales agents in this organization who are NOT on leave
    const availableAgents = await prisma.user.findMany({
      where: {
        orgId,
        isOnLeave: false,
        role: {
          in: [Role.AGENT, Role.MANAGER, Role.ADMIN],
        },
      },
      select: {
        id: true,
        _count: {
          select: {
            assignedLeads: true,
          },
        },
      },
      orderBy: {
        assignedLeads: {
          _count: 'asc', // Prioritize agent with fewest assigned leads
        },
      },
    });

    if (availableAgents.length === 0) {
      return null; // All agents are on leave or none exist
    }

    return availableAgents[0].id;
  }
}


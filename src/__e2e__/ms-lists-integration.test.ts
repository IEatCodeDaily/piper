/**
 * E2E: MS Lists Integration — Full Data Flow Through Graph Mock
 *
 * Tests the complete data pipeline using PlaceholderGraphRepository with
 * MockGraphClient:
 * - Workspace listing and summaries
 * - Task listing with filters (status, project, assignee)
 * - Project listing with aggregates
 * - Comment listing and creation
 * - Task update and create
 * - People collection from graph entities
 *
 * NEV-18 — Phase 1 hardening.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { PlaceholderGraphRepository } from "@/lib/graph/placeholder-graph-repository";
import { mockGraphClient } from "@/lib/graph/graph-client";
import { coreOpsWorkspaceFixture } from "@/features/workspaces/fixtures";
import type { PiperRepository } from "@/lib/repository/piper-repository";

describe("E2E: MS Lists Integration (Graph Mock)", () => {
  let repo: PiperRepository;

  beforeEach(() => {
    repo = new PlaceholderGraphRepository({
      workspaceConfigs: [coreOpsWorkspaceFixture],
      graphClient: mockGraphClient,
    });
  });

  // -------------------------------------------------------------------------
  // Workspace
  // -------------------------------------------------------------------------

  describe("workspace listing", () => {
    it("lists workspaces from graph data", async () => {
      const workspaces = await repo.listWorkspaces();
      expect(workspaces.length).toBeGreaterThanOrEqual(1);

      const ws = workspaces[0];
      expect(ws.id).toBeTruthy();
      expect(ws.name).toBeTruthy();
      expect(ws.mode).toBe("graph");
      expect(ws.summary.taskCount).toBeGreaterThanOrEqual(0);
      expect(ws.summary.projectCount).toBeGreaterThanOrEqual(0);
    });

    it("returns active workspace", async () => {
      const ws = await repo.getActiveWorkspace();
      expect(ws.id).toBe(coreOpsWorkspaceFixture.workspace.id);
    });
  });

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------

  describe("task listing", () => {
    it("lists all tasks from graph data", async () => {
      const tasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      expect(tasks.length).toBeGreaterThan(0);
      for (const task of tasks) {
        expect(task.id).toBeTruthy();
        expect(task.title).toBeTruthy();
        expect(task.workspaceId).toBe(coreOpsWorkspaceFixture.workspace.id);
        expect(task.createdAt).toBeTruthy();
        expect(task.updatedAt).toBeTruthy();
      }
    });

    it("excludes done tasks by default", async () => {
      const allTasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });
      const openTasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
      });

      if (allTasks.some((t) => t.status === "done")) {
        expect(openTasks.length).toBeLessThan(allTasks.length);
      }
    });

    it("filters by status", async () => {
      const backlogTasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        statuses: ["backlog"],
      });

      for (const task of backlogTasks) {
        expect(task.status).toBe("backlog");
      }
    });

    it("tasks have valid status values", async () => {
      const validStatuses = ["backlog", "planned", "in-progress", "blocked", "in-review", "done"];
      const tasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      for (const task of tasks) {
        expect(validStatuses).toContain(task.status);
      }
    });

    it("tasks have valid priority values", async () => {
      const validPriorities = ["low", "medium", "high", "urgent"];
      const tasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      for (const task of tasks) {
        expect(validPriorities).toContain(task.priority);
      }
    });

    it("tasks are sorted by sortOrder", async () => {
      const tasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      for (let i = 1; i < tasks.length; i++) {
        expect(tasks[i].sortOrder).toBeGreaterThanOrEqual(tasks[i - 1].sortOrder);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  describe("project listing", () => {
    it("lists projects from graph data", async () => {
      const projects = await repo.listWorkspaceProjects({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      expect(projects.length).toBeGreaterThan(0);
      for (const project of projects) {
        expect(project.id).toBeTruthy();
        expect(project.title).toBeTruthy();
        expect(project.workspaceId).toBe(coreOpsWorkspaceFixture.workspace.id);
      }
    });

    it("projects have task aggregates", async () => {
      const projects = await repo.listWorkspaceProjects({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      const totalTasks = projects.reduce((sum, p) => sum + p.taskCount, 0);
      expect(totalTasks).toBeGreaterThanOrEqual(0);

      for (const project of projects) {
        expect(project.openTaskCount).toBeLessThanOrEqual(project.taskCount);
      }
    });

    it("excludes completed projects by default", async () => {
      const allProjects = await repo.listWorkspaceProjects({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });
      const openProjects = await repo.listWorkspaceProjects({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
      });

      if (allProjects.some((p) => p.status === "complete")) {
        expect(openProjects.length).toBeLessThan(allProjects.length);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Task mutations
  // -------------------------------------------------------------------------

  describe("task mutations", () => {
    it("updates a task title", async () => {
      const tasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      if (tasks.length === 0) return;

      const target = tasks[0];
      const updated = await repo.updateTask({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        taskId: target.id,
        patch: { title: "Updated Title" },
      });

      expect(updated.title).toBe("Updated Title");
      expect(updated.updatedAt).not.toBe(target.updatedAt);
    });

    it("updates task status and priority", async () => {
      const tasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      if (tasks.length === 0) return;

      const updated = await repo.updateTask({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        taskId: tasks[0].id,
        patch: { status: "in-progress", priority: "urgent" },
      });

      expect(updated.status).toBe("in-progress");
      expect(updated.priority).toBe("urgent");
    });

    it("persists task updates across reads", async () => {
      const tasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      if (tasks.length === 0) return;

      const target = tasks[0];
      await repo.updateTask({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        taskId: target.id,
        patch: { title: "Persisted Title" },
      });

      // Re-fetch and verify
      const refreshed = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      const found = refreshed.find((t) => t.id === target.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe("Persisted Title");
    });

    it("throws when updating nonexistent task", async () => {
      await expect(
        repo.updateTask({
          workspaceId: coreOpsWorkspaceFixture.workspace.id,
          taskId: "nonexistent-task",
          patch: { title: "Nope" },
        }),
      ).rejects.toThrow();
    });

    it("creates a new task with correct fields", async () => {
      const newTask = await repo.createTask({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        title: "E2E Created Task",
        status: "planned",
        priority: "high",
        labels: ["e2e"],
      });

      expect(newTask.title).toBe("E2E Created Task");
      expect(newTask.status).toBe("planned");
      expect(newTask.priority).toBe("high");
      expect(newTask.labels).toEqual(["e2e"]);
      expect(newTask.id).toBeTruthy();
      expect(newTask.workspaceId).toBe(coreOpsWorkspaceFixture.workspace.id);
      expect(newTask.createdAt).toBeTruthy();
      expect(newTask.updatedAt).toBeTruthy();
      expect(newTask.externalId).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------

  describe("comments", () => {
    it("creates a comment", async () => {
      const tasks = await repo.listWorkspaceTasks({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        includeCompleted: true,
      });

      if (tasks.length === 0) return;

      const comment = await repo.createComment({
        workspaceId: coreOpsWorkspaceFixture.workspace.id,
        entityType: "task",
        entityId: tasks[0].id,
        body: "E2E test comment",
        bodyFormat: "plain-text",
      });

      expect(comment.body).toBe("E2E test comment");
      expect(comment.entityId).toBe(tasks[0].id);
      expect(comment.id).toBeTruthy();
      expect(comment.createdAt).toBeTruthy();
    });

    it("lists workspace comments", async () => {
      const comments = await repo.listWorkspaceComments(
        coreOpsWorkspaceFixture.workspace.id,
      );
      expect(Array.isArray(comments)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // People
  // -------------------------------------------------------------------------

  describe("people", () => {
    it("collects people from graph entities", async () => {
      const people = await repo.listWorkspacePeople(
        coreOpsWorkspaceFixture.workspace.id,
      );

      expect(Array.isArray(people)).toBe(true);

      for (const person of people) {
        expect(person.id).toBeTruthy();
        expect(person.displayName).toBeTruthy();
        expect(person.email).toBeTruthy();
      }
    });
  });
});

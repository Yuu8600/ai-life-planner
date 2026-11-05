import { DemoRepositories } from '@/services/demo/DemoRepositories';
import { DEMO_AFTERNOON, DEMO_DATE, DEMO_START } from '@/services/demo/sampleData';
import {
  approvePlannerProposal,
  PlannerPreviewStaleError,
  PlannerReplanConflictError,
  RuleBasedPlannerProvider,
} from '@/features/planner';
import { generatePlannerPreview } from '@/features/planner/plannerPreview';
import { loadPlannerInput } from '@/features/planner/loadPlannerInput';
import { getUtcDayBounds, getUtcInstantForLocalTime } from '@/features/today';

function dependencies(demo: DemoRepositories) {
  return {
    calendarRepository: demo.calendarRepository,
    goalRepository: demo.goalRepository,
    taskRepository: demo.taskRepository,
    settingsRepository: demo.settingsRepository,
    now: demo.now,
  };
}
async function preview(demo: DemoRepositories, replan = false) {
  const result = await generatePlannerPreview({
    ...dependencies(demo),
    provider: new RuleBasedPlannerProvider(),
    ...(replan ? { replanRepository: demo.replanRepository } : {}),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}
async function save(demo: DemoRepositories) {
  return approvePlannerProposal(
    demo.persistenceRepository,
    await preview(demo),
    dependencies(demo),
  );
}

describe('browser-only Demo repositories with the shared Planner core', () => {
  it('uses a frozen clock and produces the four expected free slots without external I/O', async () => {
    const demo = new DemoRepositories();
    const input = await loadPlannerInput(dependencies(demo));
    expect(demo.now().toISOString()).toBe(DEMO_START);
    expect(input.goals[0].title).toBe('TOEIC 730点を達成する');
    expect(input.tasks).toHaveLength(4);
    expect(input.calendarEvents).toHaveLength(3);
    expect(input.freeSlots.map((slot) => slot.durationMinutes)).toEqual([60, 150, 210, 240]);
    const result = await preview(demo);
    expect(result.proposal.actions).toHaveLength(4);
    expect(result.proposal.actions.map((action) => action.title)).toEqual([
      '英単語学習',
      'Part 5演習',
      'リスニング',
      '模試復習',
    ]);
    expect((await demo.todayRepository.getToday()).plan).toBeNull();
  });

  it('supports Task CRUD, Goal associations, and independently owned tab sessions', async () => {
    const demo = new DemoRepositories();
    const [goal] = await demo.goalRepository.list();
    const task = await demo.taskRepository.create({
      title: '単語テスト',
      estimatedMinutes: 20,
      goalId: goal.id,
      deadline: null,
      priority: 'high',
      status: 'pending',
    });
    await demo.taskRepository.update(task.id, { estimatedMinutes: 25, title: '単語テスト復習' });
    expect((await demo.taskRepository.findById(task.id))?.estimatedMinutes).toBe(25);
    expect(
      (await loadPlannerInput(dependencies(demo))).tasks.some((item) => item.id === task.id),
    ).toBe(true);
    const copy = await demo.taskRepository.list();
    copy[0].title = 'outside mutation';
    expect((await demo.taskRepository.list())[0].title).toBe('英単語学習');
    await demo.goalRepository.remove(goal.id);
    expect((await demo.taskRepository.list()).every((item) => item.goalId === null)).toBe(true);
    await demo.taskRepository.remove(task.id);
    expect(await demo.taskRepository.findById(task.id)).toBeNull();
    expect(await new DemoRepositories().taskRepository.list()).toHaveLength(4);
  });

  it('changes Settings and filters sample events by actual day intervals across timezones', async () => {
    const demo = new DemoRepositories();
    const bounds = getUtcDayBounds(DEMO_DATE, 'Asia/Tokyo');
    expect((await demo.calendarRepository.listEvents(bounds, DEMO_DATE)).events).toHaveLength(3);
    expect(
      (
        await demo.calendarRepository.listEvents(
          getUtcDayBounds('2026-11-07', 'Asia/Tokyo'),
          '2026-11-07',
        )
      ).events,
    ).toEqual([]);
    await demo.settingsRepository.updateProfilePlanningSettings({
      timezone: 'America/Los_Angeles',
      planningStart: '08:00',
      planningEnd: '23:00',
      minimumFreeMinutes: 20,
    });
    const input = await loadPlannerInput(dependencies(demo));
    expect(input.date).toBe('2026-11-05');
    expect(input.timezone).toBe('America/Los_Angeles');
    await expect(
      demo.settingsRepository.updateProfilePlanningSettings({
        timezone: 'invalid',
        planningStart: '08:00',
        planningEnd: '23:00',
        minimumFreeMinutes: 20,
      }),
    ).rejects.toThrow();
    expect((await demo.settingsRepository.getProfilePlanningSettings()).timezone).toBe(
      'America/Los_Angeles',
    );
  });

  it('saves Preview to Today, replaces the same day, and creates fresh Action IDs', async () => {
    const demo = new DemoRepositories();
    const first = await save(demo);
    const oldIds = (await demo.todayRepository.getToday()).plan!.actions.map((action) => action.id);
    const second = await save(demo);
    const today = await demo.todayRepository.getToday();
    expect(first.id).toBe(second.id);
    expect(today.plan!.actions).toHaveLength(4);
    expect(today.plan!.actions.every((action) => !oldIds.includes(action.id))).toBe(true);
    expect(today.plan!.actions[0].goalTitle).toBe('TOEIC 730点を達成する');
  });

  it('completes Task atomically, skips only Action, and logs idempotent snapshots', async () => {
    const demo = new DemoRepositories();
    await save(demo);
    const [first, second] = (await demo.todayRepository.getToday()).plan!.actions;
    await demo.executionRepository.transition({ actionId: first.id, targetStatus: 'completed' });
    await demo.executionRepository.transition({ actionId: first.id, targetStatus: 'completed' });
    await demo.executionRepository.transition({ actionId: second.id, targetStatus: 'skipped' });
    expect((await demo.taskRepository.findById(first.taskId!))?.status).toBe('completed');
    expect((await demo.taskRepository.findById(second.taskId!))?.status).toBe('pending');
    await expect(
      demo.executionRepository.transition({ actionId: first.id, targetStatus: 'skipped' }),
    ).rejects.toThrow();
    const logs = await demo.activityLogRepository.listForPlanDate(DEMO_DATE);
    expect(logs).toHaveLength(2);
    await demo.taskRepository.remove(first.taskId!);
    await save(demo);
    expect(await demo.activityLogRepository.listForPlanDate(DEMO_DATE)).toEqual(logs);
  });

  it('replans after 15:00, excludes completed Tasks, includes skipped Tasks and retains history', async () => {
    const demo = new DemoRepositories();
    await save(demo);
    const [completed, skipped] = (await demo.todayRepository.getToday()).plan!.actions;
    await demo.executionRepository.transition({
      actionId: completed.id,
      targetStatus: 'completed',
    });
    await demo.executionRepository.transition({ actionId: skipped.id, targetStatus: 'skipped' });
    const logs = await demo.activityLogRepository.listForPlanDate(DEMO_DATE);
    demo.advanceToAfternoon();
    expect(demo.now().toISOString()).toBe(DEMO_AFTERNOON);
    const result = await preview(demo, true);
    expect(result.proposal.actions).toHaveLength(3);
    expect(result.proposal.actions.some((action) => action.taskId === skipped.taskId)).toBe(true);
    expect(
      result.proposal.actions.every(
        (action) => action.taskId !== completed.taskId && action.startAt >= DEMO_AFTERNOON,
      ),
    ).toBe(true);
    await approvePlannerProposal(
      demo.persistenceRepository,
      result,
      dependencies(demo),
      () => true,
      demo.replanRepository,
    );
    expect((await demo.todayRepository.getToday()).plan!.actions).toHaveLength(3);
    expect(await demo.activityLogRepository.listForPlanDate(DEMO_DATE)).toEqual(logs);
  });

  it('rejects stale Preview on Task completion or clock advance without replacing Today', async () => {
    const demo = new DemoRepositories();
    await save(demo);
    const before = await demo.todayRepository.getToday();
    const result = await preview(demo);
    const task = result.proposal.actions[0].taskId!;
    await demo.taskRepository.update(task, { status: 'completed' });
    await expect(
      approvePlannerProposal(demo.persistenceRepository, result, dependencies(demo)),
    ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
    const newer = await preview(demo);
    demo.advanceToAfternoon();
    await expect(
      approvePlannerProposal(demo.persistenceRepository, newer, dependencies(demo)),
    ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
    expect((await demo.todayRepository.getToday()).plan).toEqual(before.plan);
  });

  it('rejects a changed Plan snapshot during replan and preserves executed state', async () => {
    const demo = new DemoRepositories();
    await save(demo);
    const result = await preview(demo, true);
    const action = (await demo.todayRepository.getToday()).plan!.actions[0];
    await demo.executionRepository.transition({ actionId: action.id, targetStatus: 'skipped' });
    await expect(
      approvePlannerProposal(
        demo.persistenceRepository,
        result,
        dependencies(demo),
        () => true,
        demo.replanRepository,
      ),
    ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
    expect((await demo.todayRepository.getToday()).plan!.actions[0].status).toBe('skipped');
  });

  it('rejects replacement with a nonpending Task before mutating any Action', async () => {
    const demo = new DemoRepositories();
    await save(demo);
    const snapshot = (await demo.replanRepository.getSnapshot(DEMO_DATE))!;
    const before = (await demo.todayRepository.getToday()).plan;
    const task = (await demo.taskRepository.list())[0];
    await demo.taskRepository.update(task.id, { status: 'completed' });
    await expect(
      demo.replanRepository.replaceIfCurrent(
        {
          planDate: DEMO_DATE,
          timezone: 'Asia/Tokyo',
          summary: 'test',
          actions: [
            {
              title: task.title,
              taskId: task.id,
              reason: 'test',
              startAt: DEMO_START,
              endAt: getUtcInstantForLocalTime(DEMO_DATE, '08:30', 'Asia/Tokyo'),
            },
          ],
        },
        snapshot,
      ),
    ).rejects.toBeInstanceOf(PlannerReplanConflictError);
    expect((await demo.todayRepository.getToday()).plan).toEqual(before);
  });

  it('completes a nullable Task Action and does not carry it into replan', async () => {
    const demo = new DemoRepositories();
    await save(demo);
    const action = (await demo.todayRepository.getToday()).plan!.actions[0];
    await demo.taskRepository.remove(action.taskId!);
    await demo.executionRepository.transition({ actionId: action.id, targetStatus: 'completed' });
    expect((await demo.activityLogRepository.listForPlanDate(DEMO_DATE))[0].taskId).toBeNull();
    expect((await preview(demo, true)).proposal.actions.every((item) => item.taskId !== null)).toBe(
      true,
    );
  });
});

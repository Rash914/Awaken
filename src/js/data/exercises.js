// Strength ladders. Each exercise climbs through form "stages"; a stage is cleared
// when the daily target reaches `advanceAt` (then the System offers a Class Advancement).
// `videos` are YouTube IDs verified by scripts/verify-videos.mjs.

export const EXERCISES = {
  pushup: {
    id: 'pushup',
    name: 'Push-ups',
    stat: 'STR',
    defaultStage: 3,
    stages: [
      { id: 'wall', name: 'Wall Push-up', advanceAt: 25, videos: ['tf3VNkmzHq0'],
        how: ['Hands on a wall at shoulder height, arms straight.', 'Body in one line from head to heels.', 'Bend elbows to ~45°, bring chest to the wall, push back.'] },
      { id: 'incline', name: 'Incline Push-up', advanceAt: 20, videos: ['tf3VNkmzHq0', 'zkU6Ok44_CI'],
        how: ['Hands on a sturdy table, bench or step.', 'Brace abs and glutes, body straight.', 'Lower chest to the edge, press away. Lower surface = harder.'] },
      { id: 'knee', name: 'Knee Push-up', advanceAt: 20, videos: ['zkU6Ok44_CI'],
        how: ['Knees on the floor, hips forward - straight line knees to head.', 'Hands just outside shoulders, elbows ~45°.', 'Chest to a fist-height above the floor, press up.'] },
      { id: 'full', name: 'Push-up', advanceAt: 25, videos: ['IODxDxX7oi4', 'zkU6Ok44_CI'],
        how: ['Hands under shoulders, feet together, body in a plank.', 'Elbows ~45° from the body, not flared.', 'Chest nearly touches the floor, full lockout at the top.'] },
      { id: 'diamond', name: 'Diamond Push-up', advanceAt: 20, videos: ['J0DnG1_S92I'],
        how: ['Thumbs and index fingers touch under the chest.', 'Elbows track back along the ribs.', 'Lower slowly, press through the palms. Triceps focus.'] },
      { id: 'decline', name: 'Decline Push-up', advanceAt: 20, videos: ['O7dVvwEK9J4'],
        how: ['Feet on a bench or bed, hands on the floor.', 'Do not let the hips sag or pike.', 'Lower head-forward of the hands, press up. Upper chest + shoulders.'] },
      { id: 'archer', name: 'Archer Push-up', advanceAt: null, videos: ['MxVbNel13Ek'],
        how: ['Very wide hands, fingers turned out.', 'Shift down toward one hand; the other arm stays straight.', 'Alternate sides. One rep = one side.'] },
    ],
  },
  squat: {
    id: 'squat',
    name: 'Squats',
    stat: 'VIT',
    defaultStage: 1,
    stages: [
      { id: 'box', name: 'Chair Squat', advanceAt: 25, videos: ['7LpLZOdz68A'],
        how: ['Stand in front of a chair, feet shoulder width.', 'Sit back until you lightly touch the seat.', 'Drive through the whole foot to stand. No bouncing.'] },
      { id: 'bodyweight', name: 'Bodyweight Squat', advanceAt: 30, videos: ['P-yaD24bUE8'],
        how: ['Feet shoulder width, toes slightly out.', 'Hips back and down, knees track over toes, chest up.', 'Thighs to parallel or below, stand tall.'] },
      { id: 'pause', name: 'Pause Squat', advanceAt: 20, videos: ['P-yaD24bUE8'],
        how: ['Same as a bodyweight squat.', 'Hold the bottom for 2 seconds - stay tight.', 'Stand up with intent.'] },
      { id: 'jump', name: 'Jump Squat', advanceAt: 20, videos: ['h5TmdMMtIT4'],
        how: ['Squat to parallel.', 'Explode up, arms drive.', 'Land softly on the balls of the feet, sink straight into the next rep.'] },
      { id: 'split', name: 'Split Squat', advanceAt: 15, videos: ['4-qkLYDckys'],
        how: ['Long stagger stance, rear heel up.', 'Drop the back knee toward the floor, torso upright.', 'Reps are per leg - count one side, then the other.'] },
      { id: 'bulgarian', name: 'Bulgarian Split Squat', advanceAt: 12, videos: ['4-qkLYDckys'],
        how: ['Rear foot on a bench or bed behind you.', 'Lower until the front thigh is parallel.', 'Push through the front heel. Reps per leg.'] },
      { id: 'pistol', name: 'Pistol Squat Progression', advanceAt: null, videos: ['vq5-vdgJc0I'],
        how: ['Hold a door frame or sit to a box on one leg.', 'Other leg straight in front.', 'Control down, drive up. Reps per leg.'] },
    ],
  },
  crunch: {
    id: 'crunch',
    name: 'Crunches',
    stat: 'CORE',
    defaultStage: 0,
    stages: [
      { id: 'crunch', name: 'Crunch', advanceAt: 30, videos: ['Xyd_fa5zoEU'],
        how: ['On your back, knees bent, feet flat.', 'Fingertips lightly behind ears - never pull the neck.', 'Curl shoulder blades off the floor, exhale, lower slowly.'] },
      { id: 'reverse', name: 'Reverse Crunch', advanceAt: 25, videos: ['XY8KzdDcMFg'],
        how: ['On your back, knees bent at 90°.', 'Curl the hips off the floor toward the ribs.', 'Lower with control - no swinging.'] },
      { id: 'bicycle', name: 'Bicycle Crunch', advanceAt: 25, videos: ['HWX93vAoLvw'],
        how: ['Shoulders off the floor, legs in the air.', 'Rotate elbow toward the opposite knee as the other leg extends.', 'Slow and controlled. One rep = one side.'] },
      { id: 'vup', name: 'V-Up', advanceAt: null, videos: ['t6OC23JDQLU'],
        how: ['Lie flat, arms overhead.', 'Lift arms and straight legs together to meet in the middle.', 'Lower slowly. Bend the knees (tuck-up) if form breaks.'] },
    ],
  },
};

export const EXERCISE_IDS = Object.keys(EXERCISES);

export function stageOf(exId, stageIndex) {
  const stages = EXERCISES[exId].stages;
  return stages[Math.max(0, Math.min(stages.length - 1, stageIndex))];
}

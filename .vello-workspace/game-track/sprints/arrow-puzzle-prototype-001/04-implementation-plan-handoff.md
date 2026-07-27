---
handoff:
  stage: implementation_plan
  status: ready_for_implementation
  next_skill: vello-game-implementation-05
  required_inputs:
    - "03-system-spec-handoff.md"
  confirmed_decisions:
    - "TECH-001: target engine is Godot"
    - "TECH-002: target scripting language is GDScript"
    - "PHASE-001: implement SYS-STAGE-CATALOG and stage-definition validation"
    - "PHASE-002: implement SYS-PATH-RULE and SYS-BOARD-STATE"
    - "PHASE-003: implement SYS-TOUCH-FEEDBACK and mobile playable-stage flow"
    - "PHASE-004: execute high-risk end-to-end verification for STAGE-001..003"
  changed_items:
    - "TECH-001"
    - "TECH-002"
    - "PHASE-001"
    - "PHASE-002"
    - "PHASE-003"
    - "PHASE-004"
  removed_items: []
  deferred_items:
    - "DEFER-001: stage-selection screen"
    - "DEFER-002: persistent progress saving"
    - "DEFER-003: stars, coins, scores, and time records"
    - "DEFER-004: ads and release features"
  bundles:
    - id: BUNDLE-001
      phases: [PHASE-001]
      targets: [SYS-STAGE-CATALOG, G-CONTENT-001, G-CONTENT-002, G-CONTENT-003]
      definition_of_done:
        - "STAGE-001..003 load as 9x9 cardinal-arrow definitions"
        - "invalid direction, duplicate cell, and out-of-bounds data are rejected"
      risk: medium
      test_bundle: TEST-001
    - id: BUNDLE-002
      phases: [PHASE-002]
      targets: [SYS-PATH-RULE, SYS-BOARD-STATE, STATE-001, STATE-002, STATE-003, STATE-004, STATE-005]
      definition_of_done:
        - "path queries report clear and blocking arrows correctly"
        - "blocked selection preserves remaining-arrow and phase state"
        - "successful extraction transitions through EXTRACTING and updates clear/progress state after completion"
      risk: high
      test_bundle: TEST-002
    - id: BUNDLE-003
      phases: [PHASE-003]
      targets: [SYS-TOUCH-FEEDBACK, G-FEEDBACK-001, G-PROG-001, G-PROG-002]
      definition_of_done:
        - "touching a remaining arrow routes selection only while READY"
        - "blocked selection shows feedback without a state change"
        - "each stage is playable on a mobile touch target and advances linearly"
        - "STAGE-003 reaches prototype-complete state"
      risk: high
      test_bundle: TEST-003
    - id: BUNDLE-004
      phases: [PHASE-004]
      targets: [VERIFY-001, VERIFY-002, VERIFY-003, VERIFY-004, VERIFY-005]
      definition_of_done:
        - "stage data, path-rule, board-state, and end-to-end verification have recorded pass/fail evidence"
        - "all three listed valid solution orders pass"
      risk: high
      test_bundle: TEST-004
  test_bundles:
    - id: TEST-001
      scope: "stage catalog validation"
      risk: medium
      command: "Godot headless test command configured by BUNDLE-001"
    - id: TEST-002
      scope: "path-rule and board-state unit tests"
      risk: high
      command: "Godot headless test command configured by BUNDLE-002"
    - id: TEST-003
      scope: "touch, feedback, animation lock, and stage progression integration"
      risk: high
      command: "Godot headless integration command plus mobile-target manual check"
    - id: TEST-004
      scope: "STAGE-001..003 valid solution-order end-to-end verification"
      risk: high
      command: "Godot headless end-to-end command plus mobile-target manual check"
  required_next_actions:
    - "IMPLEMENT-001: execute BUNDLE-001"
    - "IMPLEMENT-002: execute BUNDLE-002 after BUNDLE-001 passes"
    - "IMPLEMENT-003: execute BUNDLE-003 after BUNDLE-002 passes"
    - "IMPLEMENT-004: execute BUNDLE-004 after BUNDLE-003 passes"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "VERIFY-PLAN-001: BUNDLE-001 is medium risk; TEST-001 must pass before BUNDLE-002"
    - "VERIFY-PLAN-002: BUNDLE-002..004 are high risk; record command, verdict, failure IDs, retest requirement, and evidence path"
  sot_updates_required:
    - "SOT-001: add TECH-001 and TECH-002 to current-design/current-design.yaml at closeout"
  refs:
    - "03-system-spec-handoff.md"
---

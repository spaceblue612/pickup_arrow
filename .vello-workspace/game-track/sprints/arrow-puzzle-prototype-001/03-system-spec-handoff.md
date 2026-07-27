---
handoff:
  stage: system_spec
  status: ready_for_implementation_plan
  next_skill: vello-game-implementation-plan-04
  required_inputs:
    - "02-design-handoff.md"
  confirmed_decisions:
    - "SYS-STAGE-CATALOG: own immutable STAGE-001..003 definitions; load by stage ID; reject non-9x9, duplicate-cell, or non-cardinal arrow data"
    - "SYS-PATH-RULE: receive selected arrow ID, remaining arrows, and grid bounds; return extractable boolean and blocking arrow IDs; scan from selected origin toward the selected cardinal board edge"
    - "SYS-BOARD-STATE: own activeStageId, remainingArrowIds, and phase; accept selection and animation-complete events; publish board-state, extraction, blocked-feedback, stage-clear, next-stage, and prototype-complete events"
    - "SYS-TOUCH-FEEDBACK: hit-test taps against remaining arrows only during READY; forward selection to SYS-BOARD-STATE; render extraction or blocked feedback from published events; return animation-complete after extraction"
    - "STATE-001: stage load transitions LOADING to READY with stage arrows as remainingArrowIds"
    - "STATE-002: READY plus blocked selection remains READY and emits blocked-feedback only"
    - "STATE-003: READY plus extractable selection transitions to EXTRACTING and emits extraction for the selected arrow"
    - "STATE-004: EXTRACTING plus animation-complete removes the selected arrow; transition to READY if arrows remain, otherwise CLEARED"
    - "STATE-005: CLEARED advances to the next ordered stage; STAGE-003 clear transitions to PROTOTYPE_COMPLETE"
  changed_items:
    - "SYS-STAGE-CATALOG"
    - "SYS-PATH-RULE"
    - "SYS-BOARD-STATE"
    - "SYS-TOUCH-FEEDBACK"
    - "STATE-001"
    - "STATE-002"
    - "STATE-003"
    - "STATE-004"
    - "STATE-005"
  removed_items: []
  deferred_items:
    - "DEFER-001: stage-selection screen"
    - "DEFER-002: persistent progress saving"
    - "DEFER-003: stars, coins, scores, and time records"
    - "DEFER-004: ads and release features"
  system_contracts:
    - id: SYS-STAGE-CATALOG
      inputs: [stageId]
      outputs: [boardDefinition, validationFailure]
      state: [immutableStageDefinitions]
      dependencies: []
    - id: SYS-PATH-RULE
      inputs: [selectedArrowId, remainingArrows, gridBounds]
      outputs: [isExtractable, blockingArrowIds]
      state: []
      dependencies: [SYS-STAGE-CATALOG]
    - id: SYS-BOARD-STATE
      inputs: [boardDefinition, arrowSelected, animationComplete]
      outputs: [boardState, extractionRequested, blockedFeedbackRequested, stageCleared, nextStageRequested, prototypeComplete]
      state: [activeStageId, remainingArrowIds, phase, pendingExtractionArrowId]
      dependencies: [SYS-STAGE-CATALOG, SYS-PATH-RULE]
    - id: SYS-TOUCH-FEEDBACK
      inputs: [touchPoint, boardState, extractionRequested, blockedFeedbackRequested]
      outputs: [arrowSelected, animationComplete]
      state: [none]
      dependencies: [SYS-BOARD-STATE]
  data_flow:
    - "STAGE-CATALOG.boardDefinition -> BOARD-STATE.stage load"
    - "TOUCH-FEEDBACK.arrowSelected -> BOARD-STATE -> PATH-RULE"
    - "PATH-RULE.isExtractable -> BOARD-STATE transition and presentation event"
    - "TOUCH-FEEDBACK.animationComplete -> BOARD-STATE remaining-arrow update"
    - "BOARD-STATE stage-clear -> STAGE-CATALOG next board or prototype-complete"
  required_next_actions:
    - "PLAN-001: create implementation bundles for stage catalog, path rule, board state, and touch-feedback integration"
    - "PLAN-002: assign high-risk gameplay-loop verification to the implementation and QA bundles"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "VERIFY-001: risk=high; validate all stage definitions before play"
    - "VERIFY-002: risk=high; unit-test cardinal path queries for clear and blocked paths"
    - "VERIFY-003: risk=high; integration-test blocked selection, successful extraction, input lock, and animation-complete state transitions"
    - "VERIFY-004: risk=high; run each listed valid stage order through STAGE-001..003 and assert next-stage/prototype-complete outcomes"
    - "VERIFY-005: verdict=pending; representative command and evidence path are assigned by the implementation plan"
  sot_updates_required:
    - "SOT-001: add SYS-* and STATE-* contracts to current-design/current-design.yaml at closeout"
  refs:
    - "02-design-handoff.md"
---

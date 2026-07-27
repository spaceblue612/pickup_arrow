---
handoff:
  stage: design
  status: ready_for_system_spec
  next_skill: vello-game-system-spec-03
  required_inputs:
    - "01-brainstorm-handoff.md"
  confirmed_decisions:
    - "G-RULE-001: board arrows use only UP, DOWN, LEFT, or RIGHT directions"
    - "G-RULE-002: an arrow is extractable only when no remaining arrow occupies a cell from its origin to that direction's board edge"
    - "G-RULE-003: selecting an extractable arrow removes it by animating it straight beyond the board edge"
    - "G-RULE-004: selecting a blocked arrow keeps all board state unchanged and plays blocked feedback"
    - "G-RULE-005: board clear occurs when the remaining-arrow set is empty"
    - "G-RULE-006: input is ignored while a successful extraction animation is active"
    - "G-PROG-001: the prototype starts at STAGE-001 and advances linearly after each clear"
    - "G-PROG-002: clearing STAGE-003 displays prototype-complete state"
    - "G-FEEDBACK-001: blocked feedback is a brief visual shake and blocked tint on the selected arrow"
    - "G-CONTENT-001: STAGE-001 uses a 9x9 grid with arrows A(2,2,RIGHT), B(2,5,DOWN), C(6,7,LEFT); valid order includes B,A,C"
    - "G-CONTENT-002: STAGE-002 uses a 9x9 grid with arrows A(2,2,RIGHT), B(2,5,DOWN), C(5,8,LEFT), D(5,6,UP), E(7,3,UP); valid order includes B,A,D,C,E"
    - "G-CONTENT-003: STAGE-003 uses a 9x9 grid with arrows A(2,2,RIGHT), B(2,5,DOWN), C(4,5,RIGHT), D(4,7,DOWN), E(6,9,LEFT), F(6,6,UP), G(8,3,UP); valid order includes D,C,B,A,F,E,G"
  changed_items:
    - "G-RULE-001"
    - "G-RULE-002"
    - "G-RULE-003"
    - "G-RULE-004"
    - "G-RULE-005"
    - "G-RULE-006"
    - "G-PROG-001"
    - "G-PROG-002"
    - "G-FEEDBACK-001"
    - "G-CONTENT-001"
    - "G-CONTENT-002"
    - "G-CONTENT-003"
  removed_items: []
  deferred_items:
    - "DEFER-001: stage-selection screen"
    - "DEFER-002: persistent progress saving"
    - "DEFER-003: stars, coins, scores, and time records"
    - "DEFER-004: ads and release features"
  required_next_actions:
    - "SPEC-BOARD-001: define board-state ownership, grid bounds, and stage-data contract"
    - "SPEC-RULE-001: define path-query input/output and extraction state transition contract"
    - "SPEC-INPUT-001: define touch hit-testing and animation input-lock contract"
    - "SPEC-FLOW-001: define stage clear, next-stage, and prototype-complete state contracts"
  blockers: []
  decisions_needed: []
  verification_requirements:
    - "VERIFY-001: only cardinal-direction arrows can be loaded"
    - "VERIFY-002: every listed valid solution order clears its corresponding stage"
    - "VERIFY-003: selecting a blocked arrow does not alter remaining-arrow state or stage progress"
    - "VERIFY-004: a cleared stage advances only to its immediate next prototype stage"
    - "VERIFY-005: clearing STAGE-003 enters prototype-complete state"
  sot_updates_required:
    - "SOT-001: add confirmed G-RULE, G-PROG, G-FEEDBACK, and G-CONTENT IDs to current-design/current-design.yaml at closeout"
  refs:
    - "01-brainstorm-handoff.md"
---

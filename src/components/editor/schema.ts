import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { screenshotBlockSpec } from "./screenshot-block";
import { stepBlockSpec, stepperBlockSpec } from "./stepper-block";

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    screenshot: screenshotBlockSpec,
    stepper: stepperBlockSpec,
    step: stepBlockSpec,
  },
});

export type EditorSchema = typeof editorSchema;

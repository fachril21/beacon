import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { screenshotBlockSpec } from "./screenshot-block";
import { stepBlockSpec, stepperBlockSpec } from "./stepper-block";
import { calloutBlockSpec } from "./callout-block";
import { buttonBlockSpec } from "./button-block";
import { columnBlockSpec, columnsBlockSpec } from "./columns-block";

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    screenshot: screenshotBlockSpec,
    stepper: stepperBlockSpec,
    step: stepBlockSpec,
    callout: calloutBlockSpec,
    button: buttonBlockSpec,
    columns: columnsBlockSpec,
    column: columnBlockSpec,
  },
});

export type EditorSchema = typeof editorSchema;

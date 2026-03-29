import { describe, expect, it } from "vitest";
import {
  detectFieldDataType,
  detectColumns,
  isColumnEditable,
  isColumnRequired,
} from "../column-type-detector";
import type { GraphListColumnDefinition } from "@/lib/graph/types";

function col(
  overrides: Partial<GraphListColumnDefinition> = {},
): GraphListColumnDefinition {
  return {
    id: "col-1",
    name: "TestCol",
    displayName: "Test Column",
    dataType: "text",
    ...overrides,
  };
}

describe("detectFieldDataType", () => {
  it.each([
    ["text", "string"],
    ["note", "text"],
    ["number", "number"],
    ["boolean", "boolean"],
    ["dateTime", "date"],
    ["person", "person"],
    ["personMulti", "person-multi"],
    ["choice", "choice"],
    ["choiceMulti", "choice-multi"],
    ["lookup", "lookup"],
    ["lookupMulti", "lookup-multi"],
    ["url", "url"],
    ["unknown", "string"],
  ] as const)("maps Graph type '%s' to Piper type '%s'", (graphType, expected) => {
    expect(detectFieldDataType(col({ dataType: graphType }))).toBe(expected);
  });
});

describe("isColumnEditable", () => {
  it("returns true for normal columns", () => {
    expect(isColumnEditable(col())).toBe(true);
  });

  it("returns false for readOnly columns", () => {
    expect(isColumnEditable(col({ readOnly: true }))).toBe(false);
  });

  it("returns false for hidden columns", () => {
    expect(isColumnEditable(col({ hidden: true }))).toBe(false);
  });

  it("returns false for system columns (ID, Created, Modified)", () => {
    expect(isColumnEditable(col({ name: "ID" }))).toBe(false);
    expect(isColumnEditable(col({ name: "Created" }))).toBe(false);
    expect(isColumnEditable(col({ name: "Modified" }))).toBe(false);
  });
});

describe("isColumnRequired", () => {
  it("returns true when required is true", () => {
    expect(isColumnRequired(col({ required: true }))).toBe(true);
  });

  it("returns false when required is false or undefined", () => {
    expect(isColumnRequired(col({ required: false }))).toBe(false);
    expect(isColumnRequired(col())).toBe(false);
  });
});

describe("detectColumns", () => {
  it("returns metadata for visible columns", () => {
    const columns: GraphListColumnDefinition[] = [
      col({ name: "Title", displayName: "Title", dataType: "text", required: true }),
      col({ name: "Status", displayName: "Status", dataType: "choice" }),
      col({ name: "HiddenCol", displayName: "Hidden", dataType: "text", hidden: true }),
    ];

    const detected = detectColumns(columns);
    expect(detected).toHaveLength(2);
    expect(detected[0].name).toBe("Title");
    expect(detected[0].dataType).toBe("string");
    expect(detected[0].required).toBe(true);
    expect(detected[1].name).toBe("Status");
    expect(detected[1].dataType).toBe("choice");
  });

  it("detects multi-value columns", () => {
    const columns: GraphListColumnDefinition[] = [
      col({ name: "Tags", dataType: "choiceMulti", multiValue: true }),
    ];

    const detected = detectColumns(columns);
    expect(detected[0].multiValue).toBe(true);
    expect(detected[0].dataType).toBe("choice-multi");
  });
});

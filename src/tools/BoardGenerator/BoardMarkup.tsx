export default function BoardMarkup() {
  return (
    <div id={"main-grid"}>
      <div className={"main-controls"}>
        <div className={"workspace-header-row"}>
          <span className={"eyebrow"}>
            {"BOARD GENERATOR"}
          </span>
          <label className={"workspace-view-selector"}>
            {"View"}
            <select id={"workspace-view"}>
              <option value={"two-columns"}>
                {"Two columns"}
              </option>
              <option value={"single-column"}>
                {"One column"}
              </option>
            </select>
          </label>
        </div>
        <h1>
          {"Printable Game Board Generator"}
        </h1>
        <p>
          {"The main purpose of this tool is to generate and print paper abstract games' boards on one A3 or two A4 sheets. Other paper formats are supported."}
        </p>
        <div id={"ui"} className={"ui"}>
          <h3>
            {"Board"}
          </h3>
          <div>
            <div>
              {"Cell shape"}
            </div>
            <div>
              <label>
                <input type={"radio"} name={"config-cell-shape"} defaultValue={"square"} defaultChecked />
                {"Square"}
              </label>
              <label>
                <input type={"radio"} name={"config-cell-shape"} defaultValue={"hexagon"} />
                {"Hexagon"}
              </label>
            </div>
          </div>
          <div id={"config-hex-orientation-row"}>
            <div>
              {"Hexagon top"}
            </div>
            <div>
              <label>
                <input type={"radio"} name={"config-hex-orientation"} defaultValue={"vertex"} defaultChecked />
                {"Vertex"}
              </label>
              <label>
                <input type={"radio"} name={"config-hex-orientation"} defaultValue={"side"} />
                {"Side"}
              </label>
            </div>
          </div>
          <div>
            <div>
              {"Board size"}
            </div>
            <div>
              <select name={"config-size-mode"} defaultValue="side">
                <option value={"side"}>
                  {"1 side"}
                </option>
                <option value={"grid"}>
                  {"2 sides"}
                </option>
                <option value={"depth"}>
                  {"3 sides"}
                </option>
              </select>
              {"🡒"}
              <span className={"config-size-dimension"}>
                <input type={"number"} id={"config-cells-per-side"} name={"config-cells-per-side"} defaultValue={""} min={"1"} />
              </span>
              <span className={"config-size-separator"}>
                {"×"}
              </span>
              <span className={"config-size-dimension"}>
                <input type={"number"} id={"config-size-rows"} name={"config-size"} defaultValue={""} min={"1"} />
              </span>
              <span className={"config-size-separator"}>
                {"×"}
              </span>
              <span className={"config-size-dimension"}>
                <input type={"number"} id={"config-size-third"} name={"config-size"} defaultValue={""} min={"1"} />
              </span>
            </div>
          </div>
          <div className={"noborder nopadding"}>
            <div>
              <label>
                <input type={"radio"} id={"config-sameSize-contain"} name={"config-sameSize"} defaultValue={"contain"} defaultChecked />
                {"Contain"}
              </label>
            </div>
            <div>
            </div>
          </div>
          <div className={"noborder nopadding"}>
            <div>
              <label>
                <input type={"radio"} id={"config-sameSize-cover"} name={"config-sameSize"} defaultValue={"cover"} />
                {"Stretch"}
              </label>
            </div>
            <div>
            </div>
          </div>
          <div className={"noborder nopaddingtop"}>
            <div>
              <label>
                <input type={"radio"} id={"config-sameSize-diff"} name={"config-sameSize"} defaultValue={"diff"} />
                {"Guide grid"}
              </label>
            </div>
            <div>
              <label>
                <input type={"checkbox"} id={"config-show-guide-grid"} />
                {"Show"}
              </label>
              {"🡒"}
              <span className={"config-base-size-dimension"}>
                <input type={"number"} id={"config-baseSize-columns"} name={"config-baseSize"} defaultValue={""} />
              </span>
              <span className={"config-base-size-separator"}>
                {"×"}
              </span>
              <span className={"config-base-size-dimension"}>
                <input type={"number"} id={"config-baseSize-rows"} name={"config-baseSize"} defaultValue={""} />
              </span>
              <span className={"config-base-size-separator"}>
                {"×"}
              </span>
              <span className={"config-base-size-dimension"}>
                <input type={"number"} id={"config-baseSize-third"} name={"config-baseSize"} defaultValue={""} />
              </span>
            </div>
          </div>
          <div id={"config-theme-row"}>
            <div>
              {"Theme"}
            </div>
            <div>
              <select id={"config-theme"}>
              </select>
            </div>
          </div>
          <div className={"noborder"} id={"config-custom-theme-row"}>
            <div>
              {"Colors"}
            </div>
            <div>
              <label>
                {"Light"}
                <input type={"color"} name={"config-custom-theme"} data-theme-key={"light"} />
              </label>
              <br />
              <label>
                {"Mid"}
                <input type={"color"} name={"config-custom-theme"} data-theme-key={"mid"} />
              </label>
              <br />
              <label>
                {"Dark"}
                <input type={"color"} name={"config-custom-theme"} data-theme-key={"dark"} />
              </label>
              <br />
            </div>
          </div>
          <div className={"noborder"} id={"config-custom-texture-theme-row"}>
            <div>
              {"Textures"}
            </div>
            <div>
              <label>
                {"Light"}
                <input type={"url"} name={"config-custom-texture-theme"} data-theme-key={"light"} placeholder={"Image URL"} />
              </label>
              <br />
              <label>
                {"Mid"}
                <input type={"url"} name={"config-custom-texture-theme"} data-theme-key={"mid"} placeholder={"Image URL"} />
              </label>
              <br />
              <label>
                {"Dark"}
                <input type={"url"} name={"config-custom-texture-theme"} data-theme-key={"dark"} placeholder={"Image URL"} />
              </label>
              <br />
            </div>
          </div>
          <div>
            <div>
              {"Checkered"}
            </div>
            <div>
              <label>
                <input type={"radio"} name={"config-checkered"} defaultValue={""} />
                {"no"}
              </label>
              <label>
                <input type={"radio"} name={"config-checkered"} defaultValue={"1"} defaultChecked />
                {"yes"}
              </label>
            </div>
          </div>
          <div>
            <div>
              {"Inverted"}
            </div>
            <div>
              <label>
                <input type={"radio"} name={"config-inverted"} defaultValue={""} defaultChecked />
                {"no"}
              </label>
              <label>
                <input type={"radio"} name={"config-inverted"} defaultValue={"1"} />
                {"yes"}
              </label>
            </div>
          </div>
          <div>
            <div>
              {"Cells' border"}
            </div>
            <div>
              <label>
                <input type={"radio"} name={"config-grid"} defaultValue={""} defaultChecked />
                {"no"}
              </label>
              <label>
                <input type={"radio"} name={"config-grid"} defaultValue={"theme"} />
                {"theme"}
              </label>
              <label>
                <input type={"radio"} name={"config-grid"} defaultValue={"#000000"} data-custom-color-radio="" />
                {"custom"}
                <input type={"color"} id={"config-grid-custom-color"} defaultValue={"#000000"} aria-label={"Custom cell border color"} />
              </label>
            </div>
          </div>
          <div>
            <div>
              {"Board's border"}
            </div>
            <div>
              <label>
                <input type={"radio"} name={"config-board-border"} defaultValue={""} />
                {"no"}
              </label>
              <label>
                <input type={"radio"} name={"config-board-border"} defaultValue={"theme"} defaultChecked />
                {"theme"}
              </label>
              <label>
                <input type={"radio"} name={"config-board-border"} defaultValue={"#000000"} data-custom-color-radio="" />
                {"custom"}
                <input type={"color"} id={"config-board-border-custom-color"} defaultValue={"#000000"} aria-label={"Custom board border color"} />
              </label>
            </div>
          </div>
          <h3>
            {"Sheet"}
          </h3>
          <div>
            <div>
              {"Format"}
            </div>
            <div>
              <select id={"config-format"} defaultValue="a4">
                <option value={"a0"}>
                  {"A0"}
                </option>
                <option value={"a1"}>
                  {"A1"}
                </option>
                <option value={"a2"}>
                  {"A2"}
                </option>
                <option value={"a3"}>
                  {"A3"}
                </option>
                <option value={"a4"}>
                  {"A4"}
                </option>
                <option value={"a5"}>
                  {"A5"}
                </option>
                <option value={"a6"}>
                  {"A6"}
                </option>
                <option value={"a7"}>
                  {"A7"}
                </option>
                <option value={"a8"}>
                  {"A8"}
                </option>
                <option value={"a9"}>
                  {"A9"}
                </option>
                <option value={"a10"}>
                  {"A10"}
                </option>
                <option value={"b0"}>
                  {"B0"}
                </option>
                <option value={"b1"}>
                  {"B1"}
                </option>
                <option value={"b2"}>
                  {"B2"}
                </option>
                <option value={"b3"}>
                  {"B3"}
                </option>
                <option value={"b4"}>
                  {"B4"}
                </option>
                <option value={"b5"}>
                  {"B5"}
                </option>
                <option value={"b6"}>
                  {"B6"}
                </option>
                <option value={"b7"}>
                  {"B7"}
                </option>
                <option value={"b8"}>
                  {"B8"}
                </option>
                <option value={"b9"}>
                  {"B9"}
                </option>
                <option value={"b10"}>
                  {"B10"}
                </option>
                <option value={"c0"}>
                  {"C0"}
                </option>
                <option value={"c1"}>
                  {"C1"}
                </option>
                <option value={"c2"}>
                  {"C2"}
                </option>
                <option value={"c3"}>
                  {"C3"}
                </option>
                <option value={"c4"}>
                  {"C4"}
                </option>
                <option value={"c5"}>
                  {"C5"}
                </option>
                <option value={"c6"}>
                  {"C6"}
                </option>
                <option value={"c7"}>
                  {"C7"}
                </option>
                <option value={"c8"}>
                  {"C8"}
                </option>
                <option value={"c9"}>
                  {"C9"}
                </option>
                <option value={"c10"}>
                  {"C10"}
                </option>
                <option value={"dl"}>
                  {"dl"}
                </option>
                <option value={"letter"}>
                  {"letter"}
                </option>
                <option value={"government-letter"}>
                  {"government-letter"}
                </option>
                <option value={"legal"}>
                  {"legal"}
                </option>
                <option value={"junior-legal"}>
                  {"junior-legal"}
                </option>
                <option value={"ledger"}>
                  {"ledger"}
                </option>
                <option value={"tabloid"}>
                  {"tabloid"}
                </option>
                <option value={"credit-card"}>
                  {"credit-card"}
                </option>
                <option value={"custom"}>
                  {"Custom size"}
                </option>
              </select>
            </div>
          </div>
          <div className={"noborder"} id={"config-custom-format-row"}>
            <div>
              {"Size"}
            </div>
            <div>
              {"Width"}
              <input type={"number"} id={"config-custom-format-width"} min={"1"} step={"0.1"} />
              {"mm"}
              <br />
              {"Height"}
              <input type={"number"} id={"config-custom-format-height"} min={"1"} step={"0.1"} />
              {"mm"}
              <br />
            </div>
          </div>
          <div>
            <div>
              {"Number of sheets"}
            </div>
            <div>
              <label>
                <input type={"radio"} name={"config-split"} defaultValue={"1"} />
                {"1"}
              </label>
              <label>
                <input type={"radio"} name={"config-split"} defaultValue={"2"} defaultChecked />
                {"2"}
              </label>
            </div>
          </div>
          <div className={"noborder"}>
            <div>
              <button type={"button"} value={"0"} id={"pdf-preview-button"}>
                {"Preview PDF"}
              </button>
            </div>
            <div>
            </div>
          </div>
        </div>
      </div>
      <div className={"bg board-preview"}>
        <canvas id={"preview0"} width={"3508"} height={"3508"}>
        </canvas>
      </div>
      <div id={"pdf-preview"}>
        <div className={"pdf-preview-dialog"} role={"dialog"} aria-modal={"true"} aria-label={"PDF preview"}>
          <div id={"pdf-preview-actions"}>
            <a href={"#"} id={"pdf-print"}>
              {"PRINT"}
            </a>
            <a id={"pdf-download"} download={"game-board.pdf"}>
              {"DOWNLOAD PDF"}
            </a>
            <span id={"pdf-preview-close-container"}>
              <button type={"button"} id={"pdf-preview-close"} aria-label={"Close PDF preview"}>
                {"×"}
              </button>
            </span>
          </div>
          <p id={"pdf-preview-status"} role={"status"}>
            {"Preparing PDF preview…"}
          </p>
          <div id={"pdf-preview-pages"} aria-label={"PDF pages"}>
          </div>
        </div>
      </div>
    </div>
  );
}

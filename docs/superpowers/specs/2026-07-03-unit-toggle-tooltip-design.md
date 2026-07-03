# Unit Toggle And Tooltip Design

## Goal

Add a user-facing unit preference to the HTCalc ADI UI and make help popovers appear only from the small `?` help buttons.

## Design

The UI defaults to Imperial units. The calculation model remains metric internally, so the UI converts editable dimensional and temperature fields before writing values into `AdiProcessInput`. Switching units converts the currently displayed controls in place without changing the underlying recommendation.

Imperial fields display section dimensions in `in`, estimated mass in `lb`, bath uniformity in `deg F`, and process recommendation temperatures in `deg F`. Metric mode displays section dimensions in `mm`, estimated mass in `kg`, bath uniformity in `deg C`, and process recommendation temperatures in `deg C`. Composition remains `wt%`, times remain seconds/minutes, and internal scores remain unchanged.

The Settings panel receives a segmented Units control with `Imperial` and `Metric`; `Imperial` is selected by default. Unit changes trigger input value synchronization and recommendation re-rendering.

Help popovers are owned by `.help-button` only. Hovering a field label, input, select, or the surrounding form field must not display the popover. Keyboard users can still focus the `?` button to display the same text.

## Testing

Automated coverage should verify conversion helpers so Imperial defaults do not corrupt metric model state. Existing model tests should remain unchanged. UI behavior is verified through TypeScript/build checks and the running Vite server.

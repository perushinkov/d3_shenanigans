# d3_shenanigans
This is just a speed-coded d3.js map + graph building algorithm.

Here's a link to the Github Pages: https://perushinkov.github.io/d3_shenanigans/

1. Press 'Fit map on view' btn.
2. Press 'Connect hub to locations'
3. Enjoy as the hub is being connected to each location.

NOTES:
- Locations on map are generated with a random uniform distributions.
- The map is zoomable/navigable.
- Currently the locations can only be regenerated with a page refresh.
- The locations consist of 2 circle elements that scale/translate slightly differently, so as to create a fun pseudo-3d effect
- The algorithm is greedy, and does not guarantee an optimal solution.
- The algorithm is steppable, meaning it generates one new road section at a time. This also means that it can be run on existing road segments, and combined with other approaches.
- The coordinate system line styling is a function of the line function itself.

Inspiration:
This was inspired by the SciCraft Minecraft server, where they had connected all the locations on their maps with 'transport'. I decided I want a tool that generates the road coordinates given the locations and optionally the already built road sections.

TODOS:
- the code in here is just a JS God Object (shame, shame). A rewrite to Angular is planned. (Once Angular Elements is improved enough, I might make an export to CustomElement possible).
- fix a few road building artefacts
- add a lot more functionality, such as: locations input, export/import road segments, numbers on the side of the map viewer for current coordinate, hover with info for locations, switcher between location data sets (Nether, Overworld, etc).

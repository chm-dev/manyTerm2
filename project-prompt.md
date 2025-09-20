We want to create electron app which will be mainly used as a terminal emulator, but will also have additional components.
It will be an electron app with React frontend.
The main window will allow the user to drag and drop components and arrange them freely. 

Library which will allow arranging the layout will be https://github.com/caplin/FlexLayout
First two sample components are 
1. Terminal emulator using xtermjs
2. Text editor using monaco

Important: use prebuilt node-pty library from @lydell/node-pty instead of default one. 

Remeber about resizing terminal on flex layout changes.

Audio Compressor is an addon that uses dynamic range compression to make sound volumes more even. 

There are presets for different levels of compression. You can customize the default settings or 
the settings for a specific site or page.

There are some sites it doesn't work with, cross-origin browser security blocks scripts from modifying
audio/video from a different host. As far as I know there's no way around this. 

This works by using the Web Audio API to get the audio context for a page, and inserting a [DynamicsCompressorNode](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode).

![Audio Compressor screenshot](/screenshots/screenshot1.png)

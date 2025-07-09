# Obsidian Image Width Slider Plugin
> A plugin for Obsidian that allows you to adjust the width of images in the current note using a simple slider in the status bar.

-## Features

- Adjust the width of images using a slider in the status bar.
- Increase or decrease image sizes to customize your viewing experience.
- Simple and intuitive interface for easy usage.

### Feature: Custom for Individual Files using YAML

With the Obsidian Image Width Slider Plugin, you can customize image widths for individual files by specifying an "image-width" field in the YAML frontmatter of your notes. This feature allows you to have different image widths for different files, giving you greater flexibility in your note-taking and editing experience.

#### Setting the Image Width

To set a custom image width for a specific file, follow these steps:

1. Open the note for which you want to customize the image width.

2. In the YAML frontmatter section at the top of the note, add an "image-width" field. The value of this field should be a number between 0 and 100, representing the desired image width as a percentage of the viewport width. For example:

   ```yaml
   ---
   title: My Customized Note
   image-width: 75
   ---
   ```

## Demo

![Demo GIF](./images/demo-gif-full-size.gif) 

> Here is a brief demo showcasing the basic functionality of the Image Width Slider plugin.

## Installation

1. Download the latest release of the plugin from the [Releases](https://github.com/MugishoMp/obsidian-image-width-slider/releases) page.
2. Extract the plugin folder from the downloaded ZIP file.
3. Copy the plugin folder into your Obsidian vault's `.obsidian/plugins` directory.
4. Launch Obsidian and open the settings.
5. Navigate to the "Community Plugins" tab and enable the "Image Width Slider" plugin.
6. Enjoy using the Image Width Slider in the status bar to adjust the image widths.

## Usage

1. Once the plugin is enabled, you will see a slider in the status bar.
2. Drag the slider to the left or right to increase or decrease the width of images.
3. The changes will be applied to all images in the current note in real-time.

## Feedback and Support

If you encounter any issues or have suggestions for improvements, please create a new [issue](https://github.com/MugishoMp/obsidian-image-width-slider/issues) on the GitHub repository.

## Support Me

If you find my work valuable or simply want to support this broke CS student's caffeine-fueled coding adventures, you can make a donation through PayPal. Your contribution is greatly appreciated and helps keep the coffee flowing! ☕️🖥️

[![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate/?hosted_button_id=E4APAMMHVJE4N)


## License

This plugin is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
---

Please note that this plugin is provided as-is without any warranty. Use it at your own risk.


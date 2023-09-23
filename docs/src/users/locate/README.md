<script setup lang="ts">
	import locateMp4 from "@source/users/locate/locate.mp4";
	import locateMobileMp4 from "@source/users/locate/locate-mobile.mp4";
</script>

# Show your location

By clicking the crosshair icon on the top left of the screen (under the zoom buttons), FacilMap will attempt to zoom to your location on the map.

FacilMap will ask your browser for your location. The first time this happens, your browser will probably ask you for permission. How exactly your browser determines your location is beyond the control of FacilMap, but be warned that it might not do it in a privacy-friendly way. More details can be found under [privacy](../privacy/#your-location).

The cross-hair icon will be shown in one of these colours:
* **Black:** Your location is not shown on the map.
* **Orange:** Your location is shown on the map and the map will follow you as your location changes.
* **Blue:** Your location is shown on the map, but the map does not follow you.

Clicking the cross-hair icon will enable the orange mode. As soon as you move the map by hand, it will switch to blue mode. To go back to orange mode, first go back to black mode by clicking the icon once and then go to orange mode by clicking it again.

Your location will be indicated as a blue circle with a blue dot at the center. Your location may be anywhere within the circle, it is not necessarily at its centre. If the circle is very small, it means that your browser could determine your location very accurately. If the circle is very big, it means that your browser had trouble to make an accurate guess about your location, and you may be anywhere within the circle.

<Screencast :desktop="locateMp4" :mobile="locateMobileMp4"></Screencast>
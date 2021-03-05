<div class="fm-main">
    <LeafletMap>
        <Toolbox v-if="context.toolbox" :interactive="context.interactive"></Toolbox>
        <SearchBox v-if="context.search" :autofocus="context.autofocus"></SearchBox>
        <!--<Legend v-if="context.legend"></Legend> -->
        <Selection></Selection>
    </LeafletMap>
</div>
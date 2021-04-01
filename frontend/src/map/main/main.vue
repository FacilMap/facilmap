<div class="fm-main">
    <LeafletMap>
        <Toolbox v-if="context.toolbox" :interactive="context.interactive"></Toolbox>
        <Legend v-if="context.legend"></Legend>
        <Import v-if="context.interactive"></Import>
        <ClickMarker></ClickMarker>

        <template #after>
            <SearchBox></SearchBox>
        </template>
    </LeafletMap>
</div>
<div class="fm-main">
    <LeafletMap>
        <Toolbox v-if="context.toolbox" :interactive="context.interactive"></Toolbox>
        <Legend v-if="context.legend"></Legend>
        <Import v-if="context.interactive"></Import>

        <template #after>
            <SearchBox v-if="context.search"></SearchBox>
        </template>
    </LeafletMap>
</div>
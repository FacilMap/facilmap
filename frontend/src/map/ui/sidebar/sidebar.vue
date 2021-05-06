<div class="fm-sidebar" :class="{ isNarrow: context.isNarrow }">
	<b-sidebar shadow backdrop right v-if="context.isNarrow" :id="id" v-model="sidebarVisible" @hidden="handleSidebarHidden" ref="sidebar">
		<b-navbar toggleable="true">
			<b-navbar-nav>
				<slot></slot>
			</b-navbar-nav>
		</b-navbar>
	</b-sidebar>

	<b-navbar variant="light" v-if="!context.isNarrow">
		<b-navbar-nav>
			<slot></slot>
		</b-navbar-nav>
	</b-navbar>
</div>
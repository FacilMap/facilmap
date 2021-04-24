<main class="home" aria-labelledby="main-title">
    <header class="hero">
		<img :src="$withBase('./logo_f.svg')" alt="" width="280" height="280">
		<h1 id="main-title">{{$title}}</h1>
		<p class="action">
			<NavLink class="action-button" :item="{ link: '/users/', text: 'User guide →' }"/>
			<NavLink class="action-button secondary" :item="{ link: '/developers/', text: 'Developer guide →' }"/>
		</p>
    </header>
</main>